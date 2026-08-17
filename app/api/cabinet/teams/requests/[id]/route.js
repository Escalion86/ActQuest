import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";

import { authOptions } from "@server/auth/authOptions";
import dbConnectGlobal from "@utils/dbConnectGlobal";
import { toStringId } from "@helpers/idAndDate";
import { getCaptainRoleQuery, TEAM_ROLE_PARTICIPANT } from "@helpers/teamRoles";
import { isBannedSystemRole } from "@helpers/teamBanAccess";
import {
  countRegularTeamMemberships,
  hasReachedRegularTeamLimit,
} from "@helpers/teamMembershipLimit";

const isElevatedRole = (role) => role === "admin" || role === "dev";
const resolveUserId = (session) =>
  toStringId(
    session?.user?.globalUserId ??
      session?.user?.userId ??
      session?.user?._id ??
      session?.user?.id,
  );

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "Необходима авторизация" },
      { status: 401 },
    );
  }

  const requestId = toStringId((await params)?.id);
  const body = await request.json().catch(() => ({}));
  const action = String(body?.action ?? body?.data?.action ?? "")
    .trim()
    .toLowerCase();
  if (!requestId || !["accept", "reject"].includes(action)) {
    return NextResponse.json(
      { success: false, error: "Некорректное действие с заявкой" },
      { status: 400 },
    );
  }

  try {
    const db = await dbConnectGlobal();
    if (!db) {
      throw new Error("Соединение с базой данных не установлено");
    }

    const TeamJoinRequestsModel = db.model("TeamJoinRequests");
    const TeamsUsersModel = db.model("TeamsUsers");
    const TeamsModel = db.model("Teams");
    const joinRequest = await TeamJoinRequestsModel.findById(requestId)
      .select({ _id: 1, teamId: 1, userId: 1, status: 1 })
      .lean();
    if (!joinRequest?._id) {
      return NextResponse.json(
        { success: false, error: "Заявка не найдена" },
        { status: 404 },
      );
    }
    if (joinRequest.status !== "pending") {
      return NextResponse.json(
        { success: false, error: "Эта заявка уже обработана" },
        { status: 409 },
      );
    }

    const actorUserId = resolveUserId(session);
    const actorRole = String(session.user.role || "")
      .trim()
      .toLowerCase();
    const captain = isElevatedRole(actorRole)
      ? true
      : Boolean(
          actorUserId &&
          (
            await TeamsUsersModel.findOne({
              teamId: joinRequest.teamId,
              userId: actorUserId,
              role: getCaptainRoleQuery(),
            })
              .select({ _id: 1 })
              .lean()
          )?._id,
        );
    if (!captain) {
      return NextResponse.json(
        { success: false, error: "Обрабатывать заявки может только капитан" },
        { status: 403 },
      );
    }

    if (action === "accept") {
      const [membership, membershipsCount, applicant] = await Promise.all([
        TeamsUsersModel.findOne({
          teamId: joinRequest.teamId,
          userId: joinRequest.userId,
        })
          .select({ _id: 1 })
          .lean(),
        countRegularTeamMemberships({
          TeamsModel,
          TeamsUsersModel,
          userId: joinRequest.userId,
        }),
        db
          .model("Users")
          .findOne({
            $or: [
              { _id: joinRequest.userId },
              { globalUserId: joinRequest.userId },
            ],
          })
          .select({ _id: 1, role: 1 })
          .lean(),
      ]);

      if (!applicant?._id || isBannedSystemRole(applicant.role)) {
        return NextResponse.json(
          { success: false, error: "Пользователь недоступен для добавления" },
          { status: 409 },
        );
      }
      if (!membership?._id && hasReachedRegularTeamLimit(membershipsCount)) {
        return NextResponse.json(
          {
            success: false,
            code: "team_limit_reached",
            error: "Игрок уже состоит в 3 командах. Добавить его нельзя.",
          },
          { status: 409 },
        );
      }
      if (!membership?._id) {
        await TeamsUsersModel.create({
          teamId: joinRequest.teamId,
          userId: joinRequest.userId,
          role: TEAM_ROLE_PARTICIPANT,
        });
      }
    }

    const status = action === "accept" ? "accepted" : "rejected";
    await TeamJoinRequestsModel.updateOne(
      { _id: requestId, status: "pending" },
      {
        $set: {
          status,
          processedAt: new Date(),
          processedByUserId: actorUserId || null,
        },
      },
    );

    return NextResponse.json(
      {
        success: true,
        data: { id: requestId, status, teamId: joinRequest.teamId },
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Failed to process team join request", error);
    return NextResponse.json(
      { success: false, error: "Не удалось обработать заявку" },
      { status: 500 },
    );
  }
}
