import type { AppRole } from "@/lib/auth";

export function dashboardPath(role: AppRole) {
  switch (role) {
    case "manager":
      return "/manager/dashboard";
    case "waiter":
      return "/waiter/dashboard";
    case "kitchen":
      return "/kitchen/dashboard";
  }
}
