import { Layers, Palette, Sun } from "lucide-react";

const features = [
  {
    icon: Layers,
    title: "Multi-view sets",
    description: "Generate front, back, side, and custom views in one batch. Consistent styling across all angles.",
  },
  {
    icon: Palette,
    title: "Color variants",
    description: "Create product shots in multiple colors instantly. Perfect for showcasing your full catalog.",
  },
  {
    icon: Sun,
    title: "Studio or outdoor scenes",
    description: "Professional studio lighting or natural outdoor environments. Choose the perfect setting.",
  },
];

export const HomepageFeatures = () => {
  return (
    <section id="product" className="py-20 lg:py-28 bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            What SnapShot does
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Everything you need for professional e-commerce photography
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-card rounded-2xl p-8 border border-border shadow-card hover:shadow-medium transition-smooth group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="w-14 h-14 rounded-xl gradient-brand flex items-center justify-center mb-6 shadow-soft group-hover:shadow-medium transition-smooth">
                <feature.icon className="w-7 h-7 text-primary-foreground" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">
                {feature.title}
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
