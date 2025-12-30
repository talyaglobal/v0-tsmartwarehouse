import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface TemperatureSelectProps {
  value?: string[];
  onChange: (values: string[]) => void;
  disabled?: boolean;
}

const TEMPERATURE_OPTIONS = [
  { id: 'ambient-with-ac', label: 'Ambient with A/C' },
  { id: 'ambient-without-ac', label: 'Ambient without A/C' },
  { id: 'ambient-with-heater', label: 'Ambient with Heater' },
  { id: 'ambient-without-heater', label: 'Ambient without Heater' },
  { id: 'chilled', label: 'Chilled (2-8°C)' },
  { id: 'frozen', label: 'Frozen (-18°C or below)' },
  { id: 'open-area-with-tent', label: 'Open Area with Tent' },
  { id: 'open-area', label: 'Open Area' },
];

export function TemperatureSelect({
  value = [],
  onChange,
  disabled = false,
}: TemperatureSelectProps) {
  const handleCheck = (id: string, checked: boolean) => {
    if (checked) {
      onChange([...value, id]);
    } else {
      onChange(value.filter(v => v !== id));
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {TEMPERATURE_OPTIONS.map(option => (
          <div key={option.id} className="flex items-center space-x-2">
            <Checkbox
              id={option.id}
              checked={value.includes(option.id)}
              onCheckedChange={(checked) => handleCheck(option.id, checked as boolean)}
              disabled={disabled}
            />
            <Label
              htmlFor={option.id}
              className="font-normal cursor-pointer"
            >
              {option.label}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}
