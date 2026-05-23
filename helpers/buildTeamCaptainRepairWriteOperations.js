const buildTeamCaptainRepairWriteOperations = ({ plans, mongoose }) => {
  const ObjectId = mongoose?.Types?.ObjectId
  if (!ObjectId) {
    throw new Error('mongoose.Types.ObjectId is required')
  }

  const validObjectId = (value) => ObjectId.isValid(value)
  const operations = []
  const seenMembershipIds = new Set()

  const pushUpdate = (membershipId, role) => {
    if (!validObjectId(membershipId) || seenMembershipIds.has(String(membershipId))) {
      return
    }

    seenMembershipIds.add(String(membershipId))
    operations.push({
      updateOne: {
        filter: { _id: new ObjectId(membershipId) },
        update: { $set: { role } },
      },
    })
  }

  ;(Array.isArray(plans) ? plans : []).forEach((plan) => {
    if (plan?.promoteMembershipId) {
      pushUpdate(plan.promoteMembershipId, 'captain')
    }

    if (Array.isArray(plan?.demoteMembershipIds)) {
      plan.demoteMembershipIds.forEach((membershipId) =>
        pushUpdate(membershipId, 'participant'),
      )
    }

    if (Array.isArray(plan?.normalizeMembershipIds)) {
      plan.normalizeMembershipIds.forEach((membershipId) =>
        pushUpdate(membershipId, 'captain'),
      )
    }
  })

  return operations
}

module.exports = buildTeamCaptainRepairWriteOperations
