import { forwardRef } from "react";
import { PROVINCES } from "@/lib/config";
import { Select } from "./input";

/** All 77 districts of Nepal, grouped by province. */
export const DistrictSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement> & { placeholder?: string }>(function DistrictSelect({ placeholder = "Select district", ...p }, ref) {
  return (
    <Select ref={ref} {...p}>
      <option value="">{placeholder}</option>
      {PROVINCES.map((pr) => (
        <optgroup key={pr.name} label={`${pr.name} Province`}>
          {pr.districts.map((d) => <option key={d} value={d}>{d}</option>)}
        </optgroup>
      ))}
    </Select>
  );
});
