// Import gallery images
import galleryFashion1 from "@/assets/homepage/gallery-fashion-1.jpg";
import galleryFashion2 from "@/assets/homepage/gallery-fashion-2.jpg";
import galleryFashion3 from "@/assets/homepage/gallery-fashion-3.jpg";
import galleryFashion4 from "@/assets/homepage/gallery-fashion-4.jpg";
import galleryFashion5 from "@/assets/homepage/gallery-fashion-5.jpg";
import galleryFashion6 from "@/assets/homepage/gallery-fashion-6.jpg";
import galleryFashion7 from "@/assets/homepage/gallery-fashion-7.jpg";
import galleryDecor1 from "@/assets/homepage/gallery-decor-1.jpg";
import galleryDecor2 from "@/assets/homepage/gallery-decor-2.jpg";
import galleryDecor3 from "@/assets/homepage/gallery-decor-3.jpg";
import galleryDecor4 from "@/assets/homepage/gallery-decor-4.jpg";
import galleryDecor5 from "@/assets/homepage/gallery-decor-5.jpg";

const galleryItems = [
  { label: "Front", category: "Fashion", image: galleryFashion1 },
  { label: "Side", category: "Fashion", image: galleryFashion2 },
  { label: "Back", category: "Fashion", image: galleryFashion3 },
  { label: "Outdoor", category: "Fashion", image: galleryFashion4 },
  { label: "Product Shot", category: "Home Decor", image: galleryDecor1 },
  { label: "Lifestyle", category: "Home Decor", image: galleryDecor2 },
  { label: "Front View", category: "Fashion", image: galleryFashion5 },
  { label: "Detail", category: "Home Decor", image: galleryDecor3 },
  { label: "Studio", category: "Fashion", image: galleryFashion6 },
  { label: "Room Scene", category: "Home Decor", image: galleryDecor4 },
  { label: "Outdoor Scene", category: "Fashion", image: galleryFashion7 },
  { label: "Close-up", category: "Home Decor", image: galleryDecor5 },
];

export const HomepageGallery = () => {
  return (
    <section id="gallery" className="py-20 lg:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Results gallery
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Sample outputs from SnapShot across different niches and styles
          </p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 lg:gap-6">
          {galleryItems.map((item, index) => (
            <div
              key={index}
              className="aspect-[3/4] rounded-xl border border-border overflow-hidden relative group cursor-pointer shadow-card hover:shadow-medium transition-smooth"
            >
              <img 
                src={item.image} 
                alt={`${item.label} - ${item.category}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/95 via-background/70 to-transparent p-4">
                <span className="block text-sm font-medium text-foreground mb-0.5">
                  {item.label}
                </span>
                <span className="text-xs text-muted-foreground">
                  {item.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
