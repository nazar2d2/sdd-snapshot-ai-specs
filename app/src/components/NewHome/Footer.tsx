import { Link } from "react-router-dom";
import logo from "@/assets/snapshot-logo.svg";

const legal = [
  { id: 1, label: "Terms & Conditions", href: "/terms" },
  { id: 2, label: "Privacy Policy", href: "/privacy" },
];

const company = [
  { id: 1, label: "About", href: "/about" },
  { id: 2, label: "Blog", href: "/blog" },
  { id: 3, label: "Careers", href: "/careers" },
];

const Footer = () => {
  return (
    <footer className="relative pt-8 pb-0 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Rounded card container */}
        <div className="rounded-3xl bg-white/[0.04] border border-white/[0.07] backdrop-blur-sm px-8 py-10 md:px-12 md:py-12">
          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-10">
            {/* Left — Brand */}
            <div className="max-w-xs shrink-0">
              <a href="/" className="inline-block w-36 mb-3">
                <img src={logo} alt="Snapshot" />
              </a>
              <p className="text-sm text-muted-foreground/60 font-body leading-relaxed">
                Snapshot handles product imagery with AI-powered tools built for modern brands.
              </p>
            </div>

            {/* Right — Link columns */}
            <div className="flex flex-wrap gap-16 md:gap-20">
              {/* Product */}
              <div>
                <h4 className="font-display font-bold text-foreground text-sm mb-4">Product</h4>
                <ul className="space-y-2.5">
                  {["Features", "Pricing", "Download"].map((item) => (
                    <li key={item}>
                      <a
                        href="#"
                        className="text-sm text-muted-foreground/50 hover:text-foreground transition-colors font-body"
                      >
                        {item}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Company */}
              <div>
                <h4 className="font-display font-bold text-foreground text-sm mb-4">Company</h4>
                <ul className="space-y-2.5">
                  {company.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={item.href}
                        className="text-sm text-muted-foreground/50 hover:text-foreground transition-colors font-body"
                      >
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Legal */}
              <div>
                <h4 className="font-display font-bold text-foreground text-sm mb-4">Legal Terms</h4>
                <ul className="space-y-2.5">
                  {legal.map((item) => (
                    <li key={item.id}>
                      <a
                        href={item.href}
                        className="text-sm text-muted-foreground/50 hover:text-foreground transition-colors font-body"
                      >
                        {item.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Giant decorative brand name */}
        <div className="relative -mt-4 select-none pointer-events-none overflow-hidden h-[120px] sm:h-[160px] md:h-[200px] lg:h-[240px]">
          <span className="absolute inset-x-0 bottom-0 text-center font-prata font-bold text-[7rem] sm:text-[10rem] md:text-[13rem] lg:text-[16rem] leading-[0.8] bg-gradient-to-b from-logo-purple/25 to-transparent bg-clip-text text-transparent translate-y-[30%]">
            Snapshot
          </span>
        </div>
      </div>

      {/* Copyright line */}
      <div className="text-center pb-6 pt-2">
        <p className="text-xs text-muted-foreground/30 font-body">
          &copy; {new Date().getFullYear()} Snapshot. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
