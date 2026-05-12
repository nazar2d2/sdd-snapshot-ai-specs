import { Link } from "react-router-dom";
import { Twitter, Linkedin, Github, Instagram } from "lucide-react";
import snapshotLogo from "@/assets/snapshot-logo.svg";

const footerLinks = {
  legal: [
    { label: "Terms of Service", href: "/terms" },
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Contact", href: "mailto:hello@snapshot.app" },
  ],
  social: [
    { label: "Twitter", icon: Twitter, href: "#" },
    { label: "LinkedIn", icon: Linkedin, href: "#" },
    { label: "GitHub", icon: Github, href: "#" },
    { label: "Instagram", icon: Instagram, href: "#" },
  ],
};

export const HomepageFooter = () => {
  return (
    <footer className="bg-muted/50 border-t border-border py-12 lg:py-16">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center justify-between gap-8">
          {/* Logo and tagline */}
          <div className="text-center lg:text-left flex flex-col items-center lg:items-start gap-2">
            <Link to="/" className="inline-flex items-center group">
              <img src={snapshotLogo} alt="SnapShot" className="h-10 w-auto" />
            </Link>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered e-commerce product photography
            </p>
          </div>

          {/* Legal links */}
          <div className="flex flex-wrap items-center justify-center gap-6">
            {footerLinks.legal.map((link, index) => (
              <a
                key={index}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-foreground transition-smooth"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Social icons */}
          <div className="flex items-center gap-4">
            {footerLinks.social.map((social, index) => (
              <a
                key={index}
                href={social.href}
                className="w-10 h-10 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/30 transition-smooth"
                aria-label={social.label}
              >
                <social.icon className="w-5 h-5" />
              </a>
            ))}
          </div>
        </div>

        <div className="mt-10 pt-8 border-t border-border text-center">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} SnapShot. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
