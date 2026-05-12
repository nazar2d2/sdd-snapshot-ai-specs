import { Wand2, Settings2, User, LogOut, Coins, ChevronsUpDown, Images } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import snapshotLogo from "@/assets/snapshot-logo.svg";

const menuItems = [
  {
    title: "Generator",
    url: "/app",
    icon: Wand2,
  },
  {
    title: "My Images",
    url: "/my-images",
    icon: Images,
  },
  {
    title: "Prompt Builder",
    url: "/prompt-builder",
    icon: Settings2,
  },
  {
    title: "Profile",
    url: "/profile",
    icon: User,
  },
];

interface AppSidebarProps {
  user?: { email?: string } | null;
  profile?: { avatar_url?: string | null; full_name?: string | null } | null;
  credits?: number;
  isCreditsLoading?: boolean;
  onLogout?: () => void;
  onTopUp?: () => void;
}

export function AppSidebar({ user, profile, credits, isCreditsLoading, onLogout, onTopUp }: AppSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const { state, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed";

  const handleNavClick = () => {
    setOpenMobile(false);
  };

  const userInitial = (profile?.full_name || user?.email)?.charAt(0).toUpperCase() ?? "U";
  const userEmail = user?.email ?? "";

  return (
    <Sidebar collapsible="icon" className="border-r border-white/[0.06]">
      {!isCollapsed && (
        <SidebarHeader className="p-4 pb-2">
          <div className="flex items-center">
            <img
              src={snapshotLogo}
              alt="Snapshot"
              className="h-8 w-auto"
            />
          </div>
        </SidebarHeader>
      )}

      <Separator className="mx-3 w-auto opacity-40" />

      <SidebarContent className="pt-4">
        <SidebarGroup className="p-3 pt-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-2">
              {menuItems.map((item) => {
                const isActive = location.pathname === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                      size="lg"
                      className={cn(
                        "rounded-lg border transition-all duration-200",
                        "group-data-[collapsible=icon]:!h-11 group-data-[collapsible=icon]:!w-11 group-data-[collapsible=icon]:!p-0 group-data-[collapsible=icon]:justify-center",
                        isActive
                          ? "bg-white/[0.06] text-foreground border-white/10"
                          : "bg-white/[0.02] text-muted-foreground border-transparent hover:bg-white/[0.04] hover:text-foreground hover:border-white/5"
                      )}
                    >
                      <NavLink
                        to={item.url}
                        onClick={handleNavClick}
                        className="flex items-center gap-3 px-3 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
                      >
                        <item.icon className="w-5 h-5 shrink-0" />
                        <span className="truncate text-[12px] font-medium tracking-tight opacity-90 group-data-[collapsible=icon]:hidden">
                          {item.title}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-3 pt-2">
        <Separator className="mx-2 w-auto opacity-40 mb-3" />

        {!isCollapsed && (
          <div className="flex items-center gap-2 px-2 py-2 rounded-lg bg-white/[0.02] border border-transparent hover:border-white/5 transition-colors">
            <Coins className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-[11px] text-muted-foreground/90 tracking-tight">
              {isCreditsLoading ? "..." : `${credits?.toLocaleString()} images remaining`}
            </span>
            {onTopUp && (
              <button
                onClick={onTopUp}
                className="ml-auto text-[11px] text-primary/90 hover:text-primary font-medium transition-colors duration-200"
              >
                Top Up
              </button>
            )}
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-3 w-full rounded-lg px-2.5 py-2.5 bg-white/[0.02] border border-transparent hover:bg-white/[0.04] hover:border-white/5 transition-all duration-200 text-left group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
              <Avatar className="h-8 w-8 rounded-lg shrink-0 border border-white/5">
                <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                <AvatarFallback className="rounded-lg text-xs font-medium bg-white/[0.06] text-foreground">
                  {userInitial}
                </AvatarFallback>
              </Avatar>
              {!isCollapsed && (
                <>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate leading-tight tracking-tight">
                      {userEmail.split("@")[0]}
                    </p>
                    <p className="text-[11px] text-muted-foreground/80 truncate leading-tight">
                      {userEmail}
                    </p>
                  </div>
                  <ChevronsUpDown className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                </>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <div className="px-2 py-2">
              <p className="text-sm font-medium">{userEmail.split("@")[0]}</p>
              <p className="text-xs text-muted-foreground truncate">{userEmail}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                handleNavClick();
                navigate("/profile");
              }}
            >
              <User className="w-4 h-4 mr-2" />
              Profile
            </DropdownMenuItem>
            {onTopUp && (
              <DropdownMenuItem onClick={onTopUp}>
                <Coins className="w-4 h-4 mr-2" />
                Top Up Credits
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={onLogout} className="text-muted-foreground">
              <LogOut className="w-4 h-4 mr-2" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
