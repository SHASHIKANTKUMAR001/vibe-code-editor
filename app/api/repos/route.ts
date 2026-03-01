import { auth } from "@/auth"
import { db } from "@/lib/db"

export async function GET() {
  const session = await auth()

  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }

  // Get GitHub account for this user
  const account = await db.account.findFirst({
    where: {
      userId: session.user.id,
      provider: "github",
    },
  })

  if (!account?.accessToken) {
    return new Response("GitHub not connected", { status: 400 })
  }

  const response = await fetch("https://api.github.com/user/repos", {
    headers: {
      Authorization: `Bearer ${account.accessToken}`,
      Accept: "application/vnd.github+json",
    },
  })

  if (!response.ok) {
    return new Response("Failed to fetch repos", { status: 500 })
  }

  const data = await response.json()

  return Response.json(data)
}