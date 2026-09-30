import { prisma } from "../config/prisma";

export class GroupService {
  /**
   * Retrieves all groups for a user with URL count.
   */
  static async getUserGroups(userId: string) {
    const groups = await prisma.group.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { urls: true },
        },
      },
    });

    return groups.map((g) => ({
      id: g.id,
      name: g.name,
      color: g.color,
      createdAt: g.createdAt,
      urlCount: g._count.urls,
    }));
  }

  /**
   * Creates a new organization group for a user with quota limits.
   */
  static async createGroup(userId: string, name: string, color?: string) {
    const trimmedName = name.trim();
    if (!trimmedName) {
      throw new Error("Group name is required");
    }

    if (trimmedName.length > 50) {
      throw new Error("Group name cannot exceed 50 characters");
    }

    // Anti-Resource Exhaustion: Quota check (max 50 groups per user)
    const currentGroupCount = await prisma.group.count({
      where: { userId },
    });
    if (currentGroupCount >= 50) {
      throw new Error("Maximum group limit (50) reached for this account");
    }

    const existing = await prisma.group.findFirst({
      where: { userId, name: trimmedName },
    });

    if (existing) {
      throw new Error("A group with this name already exists");
    }

    return prisma.group.create({
      data: {
        userId,
        name: trimmedName,
        color: color?.trim() || "#3B82F6",
      },
    });
  }

  /**
   * Updates an existing group.
   */
  static async updateGroup(groupId: string, userId: string, name?: string, color?: string) {
    const existing = await prisma.group.findFirst({
      where: { id: groupId, userId },
    });

    if (!existing) {
      throw new Error("Group not found or unauthorized");
    }

    const dataToUpdate: any = {};
    if (name !== undefined) {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error("Group name cannot be empty");
      dataToUpdate.name = trimmedName;
    }
    if (color !== undefined) {
      dataToUpdate.color = color.trim() || "#3B82F6";
    }

    return prisma.group.update({
      where: { id: groupId },
      data: dataToUpdate,
    });
  }

  /**
   * Deletes a group and unlinks associated URLs (setting groupId = null).
   */
  static async deleteGroup(groupId: string, userId: string) {
    const existing = await prisma.group.findFirst({
      where: { id: groupId, userId },
    });

    if (!existing) {
      throw new Error("Group not found or unauthorized");
    }

    return prisma.$transaction([
      prisma.url.updateMany({
        where: { groupId },
        data: { groupId: null },
      }),
      prisma.group.delete({
        where: { id: groupId },
      }),
    ]);
  }
}
