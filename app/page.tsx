import { Suspense } from "react"

import { HomeExperience, HomeExperienceFallback } from "./home-experience"

export default function Page() {
  return (
    <Suspense fallback={<HomeExperienceFallback />}>
      <HomeExperience />
    </Suspense>
  )
}
