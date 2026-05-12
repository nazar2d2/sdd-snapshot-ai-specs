import { useState, useMemo } from "react";
import { Check, ChevronsUpDown, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { worldCapitals } from "@/lib/capitals";

interface CitySelectProps {
  value: string;
  onValueChange: (value: string) => void;
}

export function CitySelect({ value, onValueChange }: CitySelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filteredCities = useMemo(() => {
    if (!search) return worldCapitals.slice(0, 50);
    return worldCapitals.filter((city) =>
      city.toLowerCase().includes(search.toLowerCase())
    );
  }, [search]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full h-12 justify-between text-base bg-card border-border hover:bg-secondary font-body"
        >
          <span className="flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span className={value ? "text-foreground" : "text-muted-foreground"}>
              {value || "Search for a capital city..."}
            </span>
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0 bg-popover border-border z-50" align="start">
        <Command className="bg-popover">
          <CommandInput 
            placeholder="Search cities..." 
            value={search}
            onValueChange={setSearch}
            className="font-body"
          />
          <CommandList>
            <CommandEmpty className="py-6 text-center text-muted-foreground font-body">
              No city found.
            </CommandEmpty>
            <CommandGroup className="max-h-64 overflow-auto">
              {filteredCities.map((city) => (
                <CommandItem
                  key={city}
                  value={city}
                  onSelect={() => {
                    onValueChange(city);
                    setOpen(false);
                  }}
                  className="font-body cursor-pointer"
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === city ? "opacity-100 text-accent" : "opacity-0"
                    )}
                  />
                  {city}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
