import FlowingBackground from "@/components/NewHome/FlowingBackground";
import Navbar from "@/components/NewHome/Navbar";
import Hero from "@/components/NewHome/Hero";
import HowItWorks from "@/components/NewHome/HowItWorks";
import ComparisonSection from "@/components/NewHome/ComparisonSection";
import SolutionSection from "@/components/NewHome/SolutionSection";
import FeaturesSection from "@/components/NewHome/FeaturesSection";
import GallerySection from "@/components/NewHome/GallerySection";
import Testimonials from "@/components/NewHome/Testimonials";
import Pricing from "@/components/NewHome/Pricing";
import FAQ from "@/components/NewHome/FAQ";
import FinalCTA from "@/components/NewHome/FinalCTA";
import Footer from "@/components/NewHome/Footer";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { ScrollOpacity } from "@/components/motion/ScrollOpacity";

const Homepage = () => {
  return (
    <SmoothScroll>
      <div className="relative min-h-screen bg-deep-black overflow-x-hidden">
        {/* Animated background - fixed position wrapper */}
        <FlowingBackground />

        {/* Content layer */}
        <div className="relative z-10">
          <Navbar />
          <main>
            <Hero />
            <ScrollOpacity>
              <FeaturesSection />
            </ScrollOpacity>
            <ScrollOpacity>
              <HowItWorks />
            </ScrollOpacity>
            <ScrollOpacity>
              <ComparisonSection />
            </ScrollOpacity>
            <ScrollOpacity>
              <SolutionSection />
            </ScrollOpacity>
            <ScrollOpacity>
              <GallerySection />
            </ScrollOpacity>
            <ScrollOpacity>
              <Testimonials />
            </ScrollOpacity>
            <ScrollOpacity>
              <Pricing />
            </ScrollOpacity>
            <ScrollOpacity>
              <FAQ />
            </ScrollOpacity>
            <ScrollOpacity>
              <FinalCTA />
            </ScrollOpacity>
          </main>
          <Footer />
        </div>
      </div>
    </SmoothScroll>
  );
};

export default Homepage;
