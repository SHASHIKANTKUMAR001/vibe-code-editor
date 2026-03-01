export interface User {
  id: string
  name: string | null        // ✅ name can be null (NextAuth/Prisma default)
  email: string
  image: string | null       // ✅ image can be null
  role: string
  createdAt: Date
  updatedAt: Date
}

export interface Project {
  id: string
  title: string
  description: string | null  // ✅ FIXED (was string)
  template: string
  createdAt: Date
  updatedAt: Date
  userId: string
  user: User
  Starmark: { isMarked: boolean }[]
}