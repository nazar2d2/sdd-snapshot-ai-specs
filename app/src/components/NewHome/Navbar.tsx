import { useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useTransform,
  AnimatePresence,
  useMotionTemplate,
} from "framer-motion";
import { Button } from "@/components/ui/button";
import logo from "@/assets/snapshot-logo.svg";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

const navLinks = [
  "Product",
  "How SnapShot Works",
  "Examples",
  "Pricing",
  "FAQ",
];

const Navbar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const navigate = useNavigate();
  const { scrollY } = useScroll();
  const pillBg = useMotionTemplate`rgba(10,10,10,${useTransform(scrollY, [0, 120], [0.4, 0.92])})`;
  const pillBorder = useMotionTemplate`rgba(255,255,255,${useTransform(scrollY, [0, 120], [0.06, 0.1])})`;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    navigate("/");
  };

  return (
    <motion.nav
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed top-0 left-0 right-0 z-50 pt-4 px-4 md:px-5 lg:px-6"
    >
      <motion.div
        className="max-w-6xl mx-auto rounded-2xl backdrop-blur-xl border transition-colors duration-300"
        style={{
          backgroundColor: pillBg,
          borderColor: pillBorder,
        }}
      >
        <div className="flex items-center justify-between h-14 md:h-[3.75rem] lg:h-16 px-4 md:px-6 lg:px-8">
          {/* Logo */}
          <a href="/" className="flex items-center shrink-0">
            <img src={logo} alt="Snapshot" className="h-8 w-auto sm:h-9" />
          </a>

          {/* Desktop links - centered */}
          <div className="hidden md:flex items-center gap-6 lg:gap-10">
            {navLinks.map((link) => (
              <a
                key={link}
                href={`/#${link.toLowerCase().replace(/\s+/g, "-")}`}
                className="text-sm font-medium text-white/70 hover:text-white transition-colors duration-200 tracking-wide"
              >
                {link}
              </a>
            ))}
          </div>

          {/* CTA / Auth buttons + Mobile menu toggle */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button
                  onClick={handleLogout}
                  className="hidden sm:block text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
                >
                  Logout
                </button>
                <Link to="/app" className="hidden sm:block">
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-logo-purple to-electric-blue text-white font-medium rounded-xl px-5 shadow-lg shadow-logo-purple/20 hover:shadow-logo-purple/40 hover:brightness-110 transition-all duration-200"
                  >
                    Dashboard
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/auth" className="hidden sm:block">
                  <span className="text-sm font-medium text-white/70 hover:text-white transition-colors duration-200">
                    Login
                  </span>
                </Link>
                <Link to="/app" className="hidden sm:block">
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-logo-purple to-electric-blue text-white font-medium rounded-xl px-5 shadow-lg shadow-logo-purple/20 hover:shadow-logo-purple/40 hover:brightness-110 transition-all duration-200"
                  >
                    Get Started
                    <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                  </Button>
                </Link>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              className="md:hidden flex flex-col justify-center gap-1.5 w-10 h-10 rounded-lg hover:bg-white/5 transition-colors"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              <motion.span
                animate={mobileOpen ? { rotate: 45, y: 5 } : { rotate: 0, y: 0 }}
                className="block w-5 h-[1.5px] bg-foreground/90 origin-center"
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              />
              <motion.span
                animate={mobileOpen ? { opacity: 0 } : { opacity: 1 }}
                className="block w-5 h-[1.5px] bg-foreground/90"
                transition={{ duration: 0.15 }}
              />
              <motion.span
                animate={mobileOpen ? { rotate: -45, y: -5 } : { rotate: 0, y: 0 }}
                className="block w-5 h-[1.5px] bg-foreground/90 origin-center"
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
              />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="md:hidden overflow-hidden mt-2 max-w-6xl mx-auto rounded-2xl border border-white/[0.08]"
          >
            <div className="bg-deep-black/95 backdrop-blur-xl rounded-2xl">
              <div className="px-6 py-5 flex flex-col gap-1">
                {navLinks.map((link) => (
                  <a
                    key={link}
                    href={`/#${link.toLowerCase().replace(/\s+/g, "-")}`}
                    className="py-3 text-sm font-medium text-white/70 hover:text-white transition-colors duration-200"
                    onClick={() => setMobileOpen(false)}
                  >
                    {link}
                  </a>
                ))}
                <div className="mt-3 pt-4 border-t border-white/[0.06] flex flex-col gap-3">
                  {user ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full border-white/15 text-foreground/90 hover:bg-white/5 rounded-xl"
                        onClick={() => { handleLogout(); setMobileOpen(false); }}
                      >
                        <LogOut className="w-3.5 h-3.5 mr-1.5" />
                        Logout
                      </Button>
                      <Link to="/app" onClick={() => setMobileOpen(false)}>
                        <Button
                          size="sm"
                          className="w-full bg-gradient-to-r from-logo-purple to-electric-blue text-white font-medium rounded-xl"
                        >
                          Dashboard
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </Link>
                    </>
                  ) : (
                    <>
                      <Link to="/auth" onClick={() => setMobileOpen(false)}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-white/15 text-foreground/90 hover:bg-white/5 rounded-xl"
                        >
                          Login
                        </Button>
                      </Link>
                      <Link to="/app" onClick={() => setMobileOpen(false)}>
                        <Button
                          size="sm"
                          className="w-full bg-gradient-to-r from-logo-purple to-electric-blue text-white font-medium rounded-xl"
                        >
                          Get Started
                          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.nav>
  );
};

export default Navbar;
