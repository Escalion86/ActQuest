import assert from "node:assert/strict";
import test from "node:test";

import {
  MAX_REGULAR_TEAMS_PER_USER,
  countRegularTeamMemberships,
  hasReachedRegularTeamLimit,
} from "../helpers/teamMembershipLimit.js";

test("лимит достигается на третьей обычной команде", () => {
  assert.equal(MAX_REGULAR_TEAMS_PER_USER, 3);
  assert.equal(hasReachedRegularTeamLimit(2), false);
  assert.equal(hasReachedRegularTeamLimit(3), true);
  assert.equal(hasReachedRegularTeamLimit(4), true);
});

test("при подсчёте технические персональные команды исключаются запросом", async () => {
  let receivedFilter = null;
  const TeamsUsersModel = {
    find: () => ({
      select: () => ({
        lean: async () => [
          { teamId: "regular-1" },
          { teamId: "personal-1" },
          { teamId: "regular-1" },
        ],
      }),
    }),
  };
  const TeamsModel = {
    countDocuments: async (filter) => {
      receivedFilter = filter;
      return 1;
    },
  };

  const result = await countRegularTeamMemberships({
    TeamsModel,
    TeamsUsersModel,
    userId: "user-1",
  });

  assert.equal(result, 1);
  assert.deepEqual(receivedFilter, {
    _id: { $in: ["regular-1", "personal-1"] },
    kind: { $ne: "personal" },
  });
});
