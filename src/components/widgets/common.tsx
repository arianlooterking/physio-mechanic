import type { ReactNode } from 'react';
import { fmt } from '../../lib/digits';
import { Icon, type IconName } from '../Icon';

export function WidgetFrame({ title, icon = 'wand', children }: { title: string; icon?: IconName; children: ReactNode }) {
  return (
    <div className="widget">
      <div className="widget-head">
        <Icon name={icon} size={18} />
        <span>{title}</span>
        <span className="live">تعاملی</span>
      </div>
      <div className="widget-body">{children}</div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  skipZero,
  format,
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  skipZero?: boolean;
  format?: (v: number) => string;
}) {
  return (
    <div className="slider">
      <label>{label}</label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={typeof label === 'string' ? label : undefined}
        onChange={(e) => {
          let v = Number(e.target.value);
          if (skipZero && Math.abs(v) < 1e-9) v = value > 0 ? -step : step;
          onChange(Math.round(v * 1000) / 1000);
        }}
      />
      <output>{format ? format(value) : fmt(value)}</output>
    </div>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { v: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="group">
      {options.map((o) => (
        <button key={o.v} aria-pressed={o.v === value} onClick={() => onChange(o.v)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
