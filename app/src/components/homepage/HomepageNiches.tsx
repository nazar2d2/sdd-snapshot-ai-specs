import { Shirt, Sofa, CheckCircle2 } from "lucide-react";

const niches = [
  {
    icon: Shirt,
    title: "Fashion",
    description: "Model photos with multiple views and consistent results per set.",
    features: [
      "Front, back, side views",
      "Consistent model styling",
      "Studio and outdoor settings",
      "Multiple color variants",
    ],
    gradient: "from-brand-purple to-brand-pink",
  },
  {
    icon: Sofa,
    title: "Home Decor",
    description: "Clean product shots and lifestyle placement scenes.",
    features: [
      "Product-focused shots",
      "Lifestyle room scenes",
      "Natural lighting options",
      "Multiple angle views",
    ],
    gradient: "from-brand-cyan to-brand-blue",
  },
];

export const HomepageNiches = () => {
  return (
    <section className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Built for two niches
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Specialized workflows for Fashion and Home Decor photography
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {niches.map((niche, index) => (
            <div
              key={index}
              className="bg-card rounded-2xl border border-border shadow-card overflow-hidden hover:shadow-medium transition-smooth"
            >
              {/* Header with gradient */}
              <div className={`bg-gradient-to-r ${niche.gradient} p-6`}>
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-background/20 backdrop-blur-sm flex items-center justify-center">
                    <niche.icon className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-primary-foreground">
                      {niche.title}
                    </h3>
                    <p className="text-primary-foreground/80 text-sm">
                      {niche.description}
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Features list */}
              <div className="p-6">
                <ul className="space-y-3">
                  {niche.features.map((feature, featureIndex) => (
                    <li key={featureIndex} className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
