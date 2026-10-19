'use client';

import { useEffect, useState } from 'react';
import Select from 'react-select';

const brand = '#1C6B59';

const styles = {
  control: (base, state) => ({
    ...base,
    minHeight: 44,
    borderRadius: 2,
    borderColor: state.isFocused ? brand : '#d9ddd5',
    backgroundColor: state.isDisabled ? '#f3f2ec' : '#fbfaf5',
    boxShadow: state.isFocused ? '0 0 0 3px #dcece3' : 'none',
    fontFamily: 'Georgia, serif',
    '&:hover': { borderColor: brand },
  }),
  valueContainer: base => ({ ...base, padding: '0 12px' }),
  input: base => ({ ...base, margin: 0, padding: 0, fontFamily: 'Georgia, serif', color: '#18211f' }),
  singleValue: base => ({ ...base, color: '#18211f', fontFamily: 'Georgia, serif' }),
  placeholder: base => ({ ...base, color: '#697572', fontFamily: 'Georgia, serif' }),
  menu: base => ({ ...base, zIndex: 40, borderRadius: 2, border: '1px solid #d9ddd5', boxShadow: '8px 8px 0 #dcece3', fontFamily: 'Georgia, serif' }),
  menuPortal: base => ({ ...base, zIndex: 80 }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isSelected ? brand : state.isFocused ? '#dcece3' : '#fffefa',
    color: state.isSelected ? '#fffefa' : '#18211f',
    fontFamily: 'Georgia, serif',
  }),
  multiValue: base => ({ ...base, backgroundColor: '#dcece3', borderRadius: 2 }),
  multiValueLabel: base => ({ ...base, color: '#12483d', fontFamily: 'Georgia, serif' }),
  multiValueRemove: base => ({ ...base, color: '#12483d', ':hover': { backgroundColor: brand, color: '#fffefa' } }),
  indicatorSeparator: base => ({ ...base, backgroundColor: '#d9ddd5' }),
  dropdownIndicator: (base, state) => ({ ...base, color: state.isFocused ? brand : '#697572' }),
};

export default function AppSelect({
  instanceId,
  inputId,
  label,
  options,
  value,
  onChange,
  isMulti = false,
  isDisabled = false,
  placeholder = 'Choose',
  error,
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const describedBy = error ? `${inputId}-error` : undefined;
  const selected = isMulti
    ? options.filter(option => (value || []).includes(option.value))
    : options.find(option => option.value === value) || null;

  return (
    <div className={`app-select ${isDisabled ? 'is-disabled' : ''}`}>
      {label && <label htmlFor={inputId}>{label}</label>}
      <Select
        instanceId={instanceId}
        inputId={inputId}
        options={options}
        value={selected}
        onChange={next => onChange(isMulti ? (next || []).map(option => option.value) : (next?.value ?? ''))}
        isMulti={isMulti}
        isDisabled={isDisabled}
        placeholder={placeholder}
        styles={styles}
        menuPortalTarget={mounted ? document.body : null}
        menuPosition="fixed"
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        classNamePrefix="app-select"
      />
      {error && <p id={describedBy} className="field-error" role="alert">{error}</p>}
    </div>
  );
}
