import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, X } from 'lucide-react';

interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = "Select options...",
  className = "",
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelectOption = (optionValue: string) => {
    const newValue = value.includes(optionValue)
      ? value.filter(v => v !== optionValue)
      : [...value, optionValue];
    onChange(newValue);
  };

  const handleRemoveOption = (optionValue: string, e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(value.filter(v => v !== optionValue));
  };

  const getSelectedLabels = () => {
    return value.map(v => {
      const option = options.find(opt => opt.value === v);
      return option ? option.label : v;
    });
  };

  const selectedLabels = getSelectedLabels();

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={isOpen}
          className={`justify-between ${className}`}
        >
          <div className="flex flex-wrap gap-1 flex-1 overflow-hidden">
            {value.length === 0 ? (
              <span className="text-muted-foreground">{placeholder}</span>
            ) : value.length === 1 ? (
              <span>{selectedLabels[0]}</span>
            ) : (
              <>
                <Badge variant="secondary" className="text-xs">
                  {selectedLabels[0]}
                </Badge>
                {value.length > 1 && (
                  <Badge variant="secondary" className="text-xs">
                    +{value.length - 1} more
                  </Badge>
                )}
              </>
            )}
          </div>
          <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0" align="start">
        <div className="max-h-64 overflow-auto">
          {options.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground">
              No options available
            </div>
          ) : (
            <div className="p-2">
              {options.map((option) => (
                <div
                  key={option.value}
                  className="flex items-center space-x-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground cursor-pointer"
                  onClick={() => handleSelectOption(option.value)}
                >
                  <Checkbox
                    checked={value.includes(option.value)}
                    readOnly
                  />
                  <span className="flex-1">{option.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {value.length > 0 && (
          <div className="border-t p-2">
            <div className="flex flex-wrap gap-1">
              {selectedLabels.map((label, index) => (
                <Badge
                  key={value[index]}
                  variant="secondary"
                  className="text-xs"
                >
                  {label}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-1 h-auto p-0 text-muted-foreground hover:text-foreground"
                    onClick={(e) => handleRemoveOption(value[index], e)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-6 text-xs"
              onClick={() => onChange([])}
            >
              Clear All
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}