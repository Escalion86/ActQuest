import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@server/auth/authOptions";
import dbConnectGlobal from "@utils/dbConnectGlobal";
import { toStringId } from "@helpers/idAndDate";
import {
  getCaptainRoleQuery,
  TEAM_ROLE_PARTICIPANT,
} from "@helpers/teamRoles";
import { canJoinTeamForRole } from "@helpers/teamBanAccess";
import {
  countRegularTeamMemberships,
  hasReachedRegularTeamLimit,
} from "@helpers/teamMembershipLimit";
import {
  TEAM_JOIN_POLICY_CLOSED,
  TEAM_JOIN_POLICY_OPEN,
  normalizeTeamJoinPolicy,
} from "@helpers/teamJoinPolicy";
import { broadcastNotificationToUsers } from "@server/pwaNotifications";

const resolveUserId = (session) =>
  toStringId(
    session?.user?.globalUserId ??
      session?.user?.userId ??
      session?.user?._id ??
      session?.user?.id,
  );

const isElevatedRole = (role) => role === "admin" || role === "dev";
const isObjectIdString = (value) => /^[0-9a-fA-F]{24}$/.test(value || "");

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

const notifyTeamCaptains = async ({ db, team, applicantUserId }) => {
  try {
    const captainMemberships = await db
      .model("TeamsUsers")
      .find({ teamId: toStringId(team?._id), role: getCaptainRoleQuery() })
      .select({ userId: 1 })
      .lean();
    const captainUserIds = Array.from(
      new Set(
        captainMemberships
          .map((membership) => toStringId(membership?.userId))
          .filter(Boolean),
      ),
    );

    if (captainUserIds.length === 0) return;

    const UsersModel = db.model("Users");
    const [captains, applicant] = await Promise.all([
      UsersModel.find({
        $or: [
          { _id: { $in: captainUserIds } },
          { globalUserId: { $in: captainUserIds } },
        ],
      })
        .select({ _id: 1, pushSubscriptions: 1 })
        .lean(),
      UsersModel.findOne({
        $or: [{ _id: applicantUserId }, { globalUserId: applicantUserId }],
      })
        .select({ name: 1, username: 1 })
        .lean(),
    ]);

    const teamId = toStringId(team?._id);
    const teamName = team?.name || "Без названия";
    const applicantName = applicant?.name || applicant?.username || "Игрок";
    const url = `/cabinet/teams?teamId=${encodeURIComponent(teamId)}&mode=edit`;

    await broadcastNotificationToUsers({
      db,
      users: captains,
      notification: {
        title: `Новая заявка в команду «${teamName}»`,
        body: `${applicantName} хочет вступить в команду.`,
        tag: `team-join-request-${teamId}-${applicantUserId}`,
        location: team?.location || "global",
        data: {
          type: "team_join_request",
          teamId,
          applicantUserId,
          url,
        },
        url,
      },
    });
  } catch (error) {
    console.error("Failed to notify team captains about join request", error);
  }
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
  if (!isObjectIdString(teamId)) {
    return NextResponse.json(
      {
        success: false,
        error: "Некорректный ID команды. Скопируйте полный ID из карточки команды.",
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
          .select({ _id: 1, name: 1, joinPolicy: 1, kind: 1, location: 1 })
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
    if (existingMembership?._id) {
      return NextResponse.json(
        { success: false, error: "Вы уже состоите в этой команде" },
        { status: 409 },
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

    const joinPolicy = normalizeTeamJoinPolicy(team.joinPolicy);
    if (joinPolicy === TEAM_JOIN_POLICY_CLOSED) {
      return NextResponse.json(
        { success: false, error: "Команда закрыта для вступления" },
        { status: 403 },
      );
    }

    if (joinPolicy === TEAM_JOIN_POLICY_OPEN) {
      const membership = await TeamsUsersModel.create({
        teamId,
        userId,
        role: TEAM_ROLE_PARTICIPANT,
      });

      if (existingRequest?._id) {
        await TeamJoinRequestsModel.updateOne(
          { _id: existingRequest._id },
          {
            $set: {
              status: "accepted",
              processedAt: new Date(),
              processedByUserId: userId,
            },
          },
        );
      }

      return NextResponse.json(
        {
          success: true,
          data: {
            id: toStringId(membership?._id),
            teamId,
            teamName: team.name || "Без названия",
            status: "accepted",
          },
        },
        { status: 201 },
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

    await notifyTeamCaptains({ db, team, applicantUserId: userId });

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
        {
          success: false,
          error: "Вы уже состоите в команде или ваша заявка уже ожидает решения капитана",
        },
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
