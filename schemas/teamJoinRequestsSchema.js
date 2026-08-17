import normalizeIdForStorage from "@helpers/normalizeIdForStorage";

const teamJoinRequestsSchema = {
  teamId: {
    type: String,
    required: true,
    trim: true,
    set: normalizeIdForStorage,
  },
  userId: {
    type: String,
    required: true,
    trim: true,
    set: normalizeIdForStorage,
  },
  status: {
    type: String,
    enum: ["pending", "accepted", "rejected"],
    default: "pending",
  },
  processedByUserId: {
    type: String,
    default: null,
    trim: true,
    set: normalizeIdForStorage,
  },
  processedAt: {
    type: Date,
    default: null,
  },
};

export default teamJoinRequestsSchema;
