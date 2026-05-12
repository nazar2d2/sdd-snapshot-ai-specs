import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "How fast are the generated images?",
    answer: "Most images are generated within 30-60 seconds. Batch generations with multiple views or variants may take a few minutes depending on the queue.",
  },
  {
    question: "Can I create color variants of my products?",
    answer: "Yes! SnapShot supports generating multiple color variants from a single product image. Simply select your desired colors in the configuration step.",
  },
  {
    question: "What niches are supported?",
    answer: "Currently, SnapShot specializes in Fashion (clothing, accessories) and Home Decor (furniture, decor items). Each niche has optimized workflows and view options.",
  },
  {
    question: "How do I download my images?",
    answer: "After generation, you can download individual images or the entire batch. Images are provided in high-resolution format suitable for e-commerce platforms.",
  },
  {
    question: "What is the Fix Image tool?",
    answer: "Fix Image is our post-generation editing tool. If a generated image needs adjustments—like fixing a hand, adjusting colors, or removing artifacts—you can use Fix Image to make targeted corrections.",
  },
  {
    question: "Can I use generated images for commercial purposes?",
    answer: "Yes, all images generated with SnapShot are yours to use commercially. You retain full rights to use them on your e-commerce store, marketing materials, and social media.",
  },
];

export const HomepageFAQ = () => {
  return (
    <section id="faq" className="py-20 lg:py-28">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12 lg:mb-16">
          <h2 className="text-3xl sm:text-4xl font-bold text-foreground mb-4">
            Frequently asked questions
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Got questions? We've got answers
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <Accordion type="single" collapsible className="space-y-4">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="bg-card rounded-xl border border-border px-6 shadow-card"
              >
                <AccordionTrigger className="text-left font-medium text-foreground hover:text-primary transition-smooth py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
};
