import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { invokeEdgeFunctionWithRetry } from "@/lib/invokeEdgeFunctionWithRetry";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Coins } from "lucide-react";

const CREDIT_PACKS = [
    { credits: 50, price: 10, label: "50 Credits", priceId: "price_1T3KQABxmnkg2dwfBhJk7HBF" },
    { credits: 150, price: 25, label: "150 Credits", priceId: "price_1T3KQaBxmnkg2dwfY3GJyPiZ" },
    { credits: 350, price: 50, label: "350 Credits", priceId: "price_1T3KR5Bxmnkg2dwfwKZfcm1X" },
    { credits: 750, price: 99, label: "750 Credits", priceId: "price_1T3KRRBxmnkg2dwfoDva8OGa" },
];

interface CreditTopUpModalProps {
    trigger?: React.ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function CreditTopUpModal({ trigger, open: controlledOpen, onOpenChange }: CreditTopUpModalProps) {
    const [internalOpen, setInternalOpen] = useState(false);
    const isOpen = controlledOpen ?? internalOpen;
    const setIsOpen = onOpenChange ?? setInternalOpen;
    const [loadingPack, setLoadingPack] = useState<number | null>(null);
    const { toast } = useToast();

    const handleBuy = async (pack: typeof CREDIT_PACKS[0]) => {
        setLoadingPack(pack.credits);
        try {
            const { data, error } = await invokeEdgeFunctionWithRetry("create-checkout", {
                body: {
                    priceId: pack.priceId,
                    mode: "payment",
                    successUrl: window.location.href,
                    cancelUrl: window.location.href,
                    isOneTime: true
                }
            });

            if (error) throw new Error((error as any).message || "Checkout failed");

            if (data?.url) {
                window.location.href = data.url;
            }
        } catch (err) {
            console.error(err);
            toast({
                title: "Checkout failed",
                description: "Could not start checkout. Please try again.",
                variant: "destructive",
            });
        } finally {
            setLoadingPack(null);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            {trigger && (
                <DialogTrigger asChild>
                    {trigger}
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Top Up Credits</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {CREDIT_PACKS.map((pack) => (
                            <div
                                key={pack.credits}
                                className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                            >
                                <div>
                                    <div className="font-semibold text-lg">{pack.label}</div>
                                    <div className="text-sm text-muted-foreground">${pack.price}</div>
                                </div>
                                <Button
                                    onClick={() => handleBuy(pack)}
                                    disabled={loadingPack !== null}
                                    variant={loadingPack === pack.credits ? "secondary" : "default"}
                                >
                                    {loadingPack === pack.credits ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buy"}
                                </Button>
                            </div>
                        ))}
                    </div>
                    <p className="text-xs text-muted-foreground text-center mt-4">
                        Secured by Stripe. Credits are added immediately after payment.
                    </p>
                </div>
            </DialogContent>
        </Dialog>
    );
}
