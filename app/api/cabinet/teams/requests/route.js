import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@server/auth/authOptions";
import dbConnectGlobal from "@utils/dbConnectGlobal";
import { toStringId } from "@helpers/idAndDate";
import { getCaptainRoleQuery } from "@helpers/teamRoles";
import { canJoinTeamForRole } from "@helpers/teamBanAccess";
import {
  countRegularTeamMemberships,
  hasReachedRegularTeamLimit,
} from "@helpers/teamMembershipLimit";

const resolveUserId = (session) =>
  toStringId(
    session?.user?.globalUserId ??
      session?.user?.userId ??
      session?.user?._id ??
      session?.user?.id,
  );

const isElevatedRole = (role) => role === "admin" || role === "dev";

const canManageTeam = async ({ db, teamId, userId, role }) => {
  if (
    isElevatedRole(
      String(role || "")
        .trim()
        .toLowerCase(),
    )
  ) {
    return true;
  }

  if (!userId) {
    return false;
  }

  const captain = await db
    .model("TeamsUsers")
    .findOne({
      teamId,
      userId,
      role: getCaptainRoleQuery(),
    })
    .select({ _id: 1 })
    .lean();

  return Boolean(captain?._id);
};

export async function GET(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Необходима авторизация" },
      { status: 401 },
    );
  }

  const teamId = toStringId(new URL(request.url).searchParams.get("teamId"));
  if (!teamId) {
    return NextResponse.json(
      { success: false, error: "Не указан идентификатор команды" },
      { status: 400 },
    );
  }

  try {
    const db = await dbConnectGlobal();
    if (!db) {
      throw new Error("Соединение с базой данных не установлено");
    }

    const userId = resolveUserId(session);
    const allowed = await canManageTeam({
      db,
      teamId,
      userId,
      role: session.user.role,
    });
    if (!allowed) {
      return NextResponse.json(
        { success: false, error: "Просматривать заявки может только капитан" },
        { status: 403 },
      );
    }

    const requests = await db
      .model("TeamJoinRequests")
      .find({
        teamId,
        status: "pending",
      })
      .sort({ createdAt: 1 })
      .lean();
    const applicantIds = Array.from(
      new Set(requests.map((item) => toStringId(item?.userId)).filter(Boolean)),
    );
    const users = applicantIds.length
      ? await db
          .model("Users")
          .find({
            $or: [
              { _id: { $in: applicantIds } },
              { globalUserId: { $in: applicantIds } },
            ],
          })
          .select({
            _id: 1,
            globalUserId: 1,
            name: 1,
            username: 1,
            photoUrl: 1,
            images: 1,
          })
          .lean()
      : [];
    const usersById = new Map();
    users.forEach((user) => {
      const ids = [
        toStringId(user?._id),
        toStringId(user?.globalUserId),
      ].filter(Boolean);
      ids.forEach((id) => usersById.set(id, user));
    });

    const data = requests.map((item) => {
      const applicantId = toStringId(item?.userId);
      const user = usersById.get(applicantId) ?? null;
      return {
        id: toStringId(item?._id),
        teamId,
        userId: applicantId,
        status: "pending",
        createdAt: item?.createdAt ?? null,
        applicant: {
          name: user?.name || user?.username || "Пользователь",
          username: user?.username || "",
          photoUrl: user?.photoUrl || "",
          images: Array.isArray(user?.images) ? user.images : [],
        },
      };
    });

    return NextResponse.json({ success: true, data }, { status: 200 });
  } catch (error) {
    console.error("Failed to load team join requests", error);
    return NextResponse.json(
      { success: false, error: "Не удалось загрузить заявки" },
      { status: 500 },
    );
  }
}

export async function POST(request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Необходима авторизация" },
      { status: 401 },
    );
  }

  if (!canJoinTeamForRole(session.user.role)) {
    return NextResponse.json(
      {
        success: false,
        error: "Заблокированный пользователь не может подавать заявки",
      },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => ({}));
  const payload =
    body?.data && typeof body.data === "object" ? body.data : body;
  const teamId = toStringId(payload?.teamId);
  const userId = resolveUserId(session);
  if (!teamId || !userId) {
    return NextResponse.json(
      {
        success: false,
        error: "Не удалось определить команду или пользователя",
      },
      { status: 400 },
    );
  }

  try {
    const db = await dbConnectGlobal();
    if (!db) {
      throw new Error("Соединение с базой данных не установлено");
    }

    const TeamsModel = db.model("Teams");
    const TeamsUsersModel = db.model("TeamsUsers");
    const TeamJoinRequestsModel = db.model("TeamJoinRequests");
    const [team, membershipsCount, existingMembership, existingRequest] =
      await Promise.all([
        TeamsModel.findById(teamId)
          .select({ _id: 1, name: 1, open: 1, kind: 1 })
          .lean(),
        countRegularTeamMemberships({ TeamsModel, TeamsUsersModel, userId }),
        TeamsUsersModel.findOne({ teamId, userId }).select({ _id: 1 }).lean(),
        TeamJoinRequestsModel.findOne({ teamId, userId })
          .select({ _id: 1, status: 1 })
          .lean(),
      ]);

    if (!team?._id || team?.kind === "personal") {
      return NextResponse.json(
        { success: false, error: "Команда не найдена" },
        { status: 404 },
      );
    }
    if (hasReachedRegularTeamLimit(membershipsCount)) {
      return NextResponse.json(
        {
          success: false,
          code: "team_limit_reached",
          error: "Вы уже состоите в 3 командах. Больше вступать нельзя.",
        },
        { status: 409 },
      );
    }
    if (existingMembership?._id) {
      return NextResponse.json(
        { success: false, error: "Вы уже состоите в этой команде" },
        { status: 409 },
      );
    }
    if (team.open !== true) {
      return NextResponse.json(
        { success: false, error: "Команда закрыта для заявок" },
        { status: 403 },
      );
    }
    if (existingRequest?.status === "pending") {
      return NextResponse.json(
        { success: false, error: "Ваша заявка уже ожидает решения капитана" },
        { status: 409 },
      );
    }

    const joinRequest = existingRequest?._id
      ? await TeamJoinRequestsModel.findByIdAndUpdate(
          existingRequest._id,
          {
            $set: {
              status: "pending",
              processedAt: null,
              processedByUserId: null,
            },
          },
          { returnDocument: "after" },
        )
      : await TeamJoinRequestsModel.create({
          teamId,
          userId,
          status: "pending",
        });

    return NextResponse.json(
      {
        success: true,
        data: {
          id: toStringId(joinRequest?._id),
          teamId,
          teamName: team.name || "Без названия",
          status: "pending",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    if (error?.code === 11000) {
      return NextResponse.json(
        { success: false, error: "Ваша заявка уже ожидает решения капитана" },
        { status: 409 },
      );
    }
    console.error("Failed to create team join request", error);
    return NextResponse.json(
      { success: false, error: "Не удалось отправить заявку" },
      { status: 500 },
    );
  }
}
