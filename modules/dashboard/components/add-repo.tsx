"use client"

import { Button } from "@/components/ui/button"
import { ArrowDown, Loader2 } from "lucide-react"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { useState } from "react"

type Repo = {
  id: number
  name: string
  description: string
  html_url: string
}

const AddRepo = () => {
  const { data: session } = useSession()

  const [repos, setRepos] = useState<Repo[]>([])
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleClick = async () => {
    if (!session) {
      alert("Please connect GitHub first")
      return
    }

    try {
      setLoading(true)
      setError("")
      setShowModal(true)

      const res = await fetch("/api/repos")

      if (!res.ok) {
        throw new Error("Failed to fetch repositories")
      }

      const data = await res.json()
      setRepos(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* CARD */}
      <div
        onClick={handleClick}
        className="group px-6 py-6 flex flex-row justify-between items-center border rounded-xl bg-muted cursor-pointer
        transition-all duration-300 ease-in-out
        hover:bg-background hover:border-[#E93F3F] hover:scale-[1.02]
        shadow-sm hover:shadow-xl"
      >
        <div className="flex flex-row items-start gap-4">
          <Button
            variant="outline"
            size="icon"
            className="bg-background group-hover:border-[#E93F3F] group-hover:text-[#E93F3F]"
          >
            <ArrowDown size={24} className="group-hover:translate-y-1 transition-transform" />
          </Button>

          <div className="flex flex-col">
            <h1 className="text-xl font-bold text-[#E93F3F]">
              Open GitHub Repository
            </h1>
            <p className="text-sm text-muted-foreground max-w-[220px]">
              Work with your repositories in our editor
            </p>
          </div>
        </div>

        <Image
          src="/github.svg"
          alt="GitHub"
          width={120}
          height={120}
          className="transition-transform duration-300 group-hover:scale-110"
        />
      </div>

      {/* MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-background text-foreground w-[500px] max-h-[500px] overflow-y-auto rounded-2xl p-6 shadow-2xl border animate-in fade-in zoom-in-95 duration-200">
            
            <h2 className="text-xl font-bold mb-4">
              Select Repository
            </h2>

            {/* Loading */}
            {loading && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="animate-spin" size={18} />
                Loading repositories...
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-red-500 text-sm mb-4">
                {error}
              </p>
            )}

            {/* Repo List */}
            {!loading && !error && repos.map((repo) => (
              <div
                key={repo.id}
                onClick={() => window.open(repo.html_url, "_blank")}
                className="p-3 border rounded-xl mb-2 hover:bg-muted transition cursor-pointer"
              >
                <h3 className="font-semibold">
                  {repo.name}
                </h3>

                {repo.description && (
                  <p className="text-sm text-muted-foreground">
                    {repo.description}
                  </p>
                )}
              </div>
            ))}

            {/* Empty State */}
            {!loading && repos.length === 0 && !error && (
              <p className="text-muted-foreground text-sm">
                No repositories found.
              </p>
            )}

            {/* Close */}
            <button
              onClick={() => setShowModal(false)}
              className="mt-4 text-sm text-red-500 hover:underline"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  )
}

export default AddRepo