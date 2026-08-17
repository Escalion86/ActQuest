import { toStringId } from "./idAndDate.js";

export const MAX_REGULAR_TEAMS_PER_USER = 3;

export const hasReachedRegularTeamLimit = (teamsCount) =>
  Number(teamsCount) >= MAX_REGULAR_TEAMS_PER_USER;

export const countRegularTeamMemberships = async ({
  TeamsModel,
  TeamsUsersModel,
  userId,
}) => {
  if (!TeamsModel || !TeamsUsersModel || !userId) {
    return 0;
  }

  const memberships = await TeamsUsersModel.find({ userId })
    .select({ teamId: 1 })
    .lean();
  const teamIds = Array.from(
    new Set(
      memberships.map((item) => toStringId(item?.teamId)).filter(Boolean),
    ),
  );

  if (teamIds.length === 0) {
    return 0;
  }

  return TeamsModel.countDocuments({
    _id: { $in: teamIds },
    kind: { $ne: "personal" },
  });
};
