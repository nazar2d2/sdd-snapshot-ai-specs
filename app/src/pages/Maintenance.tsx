import { Link } from "react-router-dom";
import { Construction, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import snapshotLogo from "@/assets/snapshot-logo.svg";

export default function Maintenance() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-6 text-center">
      {/* Logo */}
      <img src={snapshotLogo} alt="SnapShot" className="h-10 mb-10 opacity-80" />

      {/* Icon */}
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/10 mb-6">
        <Construction className="h-10 w-10 text-primary" />
      </div>

      {/* Copy */}
      <h1 className="text-3xl font-semibold text-foreground font-display tracking-tight mb-3">
        Under Maintenance
      </h1>
      <p className="text-muted-foreground max-w-md text-sm leading-relaxed mb-8">
        We're making some improvements to give you a better experience.
        <br />
        Please check back shortly — we'll be up and running soon.
      </p>

      {/* Gradient accent */}
      <div className="h-px w-40 bg-gradient-to-r from-transparent via-primary/40 to-transparent mb-8" />

      <Button asChild variant="ghost" size="sm" className="gap-2">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" />
          Back to Homepage
        </Link>
      </Button>
    </div>
  );
}
