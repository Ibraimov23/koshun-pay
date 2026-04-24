"use client";

import { TouristDashboard } from "@/components/TouristDashboard";
import { GuideDashboard } from "@/components/GuideDashboard";
import { GosDashboard } from "@/components/GosDashboard";
import { useKoshun } from "@/components/KoshunProvider";

export default function Page() {
  const { roleBadge } = useKoshun();

  if (roleBadge === "GOS") return <GosDashboard />;
  if (roleBadge === "Guide") return <GuideDashboard />;
  return <TouristDashboard />;
}

