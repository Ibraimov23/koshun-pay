"use client";

import { TouristDashboard } from "@/components/TouristDashboard";
import { GuideDashboard } from "@/components/GuideDashboard";
import { GosDashboard } from "@/components/GosDashboard";
import { OwnerDashboard } from "@/components/OwnerDashboard";
import { useKoshun } from "@/components/KoshunProvider";

export default function Page() {
  const { role, roleBadge } = useKoshun();

  if (role === "OWNER") return <OwnerDashboard />;
  if (roleBadge === "GOS") return <GosDashboard />;
  if (roleBadge === "Guide") return <GuideDashboard />;
  return <TouristDashboard />;
}

