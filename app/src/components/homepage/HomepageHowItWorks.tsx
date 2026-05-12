import { Upload, Settings, Download } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: Upload,
    title: "Upload product image",
    description: "Upload your product photo. Works best with clean product shots on neutral backgrounds.",
  },
  {
    number: "02",
    icon: Settings,
    title: "Pick niche, views, format, variants",
    description: "Choose Fashion or Home Decor. Select views, aspect ratios, and color variants for your batch.",
  },
  {
    number: "03",
    icon: Download,
    title: "Download results, use Fix Image for edits",
    description: "Download your generated images. Use our Fix Image tool to make adjustments if needed.",
  },
];

export const HomepageHowItWorks = () => {
  return (
    <section id="how-it-works" className="py-20 lg:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            How SnapShot works
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Three simple steps to professional product photography
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 relative">
          {/* Connecting line (desktop only) */}
          <div className="hidden md:block absolute top-16 left-1/6 right-1/6 h-0.5 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />
          
          {steps.map((step, index) => (
            <div key={index} className="relative text-center">
              {/* Step number badge */}
              <div className="relative z-10 mb-6">
                <div className="w-16 h-16 mx-auto rounded-2xl gradient-brand flex items-center justify-center shadow-medium">
                  <step.icon className="w-8 h-8 text-primary-foreground" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-card border-2 border-primary flex items-center justify-center">
                  <span className="text-xs font-bold text-primary">{step.number}</span>
                </div>
              </div>
              
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {step.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
