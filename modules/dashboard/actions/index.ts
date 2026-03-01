"use server";

import { db } from "@/lib/db";
import { currentUser } from "@/modules/auth/actions";
import { revalidatePath } from "next/cache";

export const toggleStarMarked = async (
  playgroundId: string,
  isChecked: boolean
): Promise<void> => {
  const user = await currentUser();
  const userId = user?.id;

  if (!userId) {
    throw new Error("User Id is Required");
  }

  try {
    if (isChecked) {
      await db.starMark.create({
        data: {
          userId,
          playgroundId,
          isMarked: isChecked,
        },
      });
    } else {
      await db.starMark.delete({
        where: {
          userId_playgroundId: {
            userId,
            playgroundId,
          },
        },
      });
    }

    revalidatePath("/dashboard");
  } catch (error) {
    console.error("Error updating problem:", error);
    throw error;
  }
};

export const getAllPlaygroundForUser = async () => {
  const user = await currentUser();

  try {
    return await db.playground.findMany({
      where: {
        userId: user?.id,
      },
      include: {
        user: true,
        Starmark: {
          where: {
            userId: user?.id!,
          },
          select: {
            isMarked: true,
          },
        },
      },
    });
  } catch (error) {
    console.log(error);
    return [];
  }
};

export const createPlayground = async (data: {
  title: string;
  template: "REACT" | "NEXTJS" | "EXPRESS" | "VUE" | "HONO" | "ANGULAR";
  description?: string;
}) => {
  const user = await currentUser();

  if (!user?.id) {
    throw new Error("User not authenticated");
  }

  const { template, title, description } = data;

  try {
    const playground = await db.playground.create({
      data: {
        title,
        description: description ?? null,
        template,
        userId: user.id,
      },
    });

    revalidatePath("/dashboard");

    return playground; // ✅ IMPORTANT
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const editProjectById = async (
  id: string,
  data: { title: string; description: string }
): Promise<void> => {
  try {
    await db.playground.update({
      where: { id },
      data: {
        title: data.title,
        description: data.description ?? null,
      },
    });

    revalidatePath("/dashboard");
  } catch (error) {
    console.log(error);
    throw error;
  }
};

export const duplicateProjectById = async (id: string): Promise<void> => {
  try {
    const originalPlayground = await db.playground.findUnique({
      where: { id },
    });

    if (!originalPlayground) {
      throw new Error("Original playground not found");
    }

    await db.playground.create({
      data: {
        title: `${originalPlayground.title} (Copy)`,
        description: originalPlayground.description,
        template: originalPlayground.template,
        userId: originalPlayground.userId,
      },
    });

    revalidatePath("/dashboard");
  } catch (error) {
    console.error("Error duplicating project:", error);
    throw error;
  }
};