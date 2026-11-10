import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';

/**
 * Type-to-filter combobox.
 *
 * Works in two modes:
 *   allowCustom={false}  the value must be one of the options (used for hospital
 *                        nodes, where the value is a database id)
 *   allowCustom={true}   the typed text becomes the value, and options are only
 *                        suggestions (used for medical specialisation)
 *
 * `groups` is [{ group: string, options: [{ value, label, sublabel }] }].
 */
export const SearchableSelect = ({
  groups = [],
  value,
  onChange,
  placeholder = 'Select...',
  searchPlaceholder = 'Type to search...',
  allowCustom = false,
  required = false,
  emptyMessage = 'No matches found.',
  footer = null,
  id
}) => {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef(null);
  const searchRef = useRef(null);

  const allOptions = useMemo(
    () => groups.flatMap(g => g.options),
    [groups]
  );

  const selectedLabel = useMemo(() => {
    const match = allOptions.find(o => String(o.value) === String(value));
    if (match) return match.label;
    // in custom mode the raw value is itself the label
    return allowCustom && value ? String(value) : '';
  }, [allOptions, value, allowCustom]);

  const filteredGroups = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return groups;
    return groups
      .map(g => ({
        ...g,
        options: g.options.filter(o =>
          o.label.toLowerCase().includes(q) ||
          (o.sublabel || '').toLowerCase().includes(q)
        )
      }))
      .filter(g => g.options.length > 0);
  }, [groups, filter]);

  const flatFiltered = useMemo(
    () => filteredGroups.flatMap(g => g.options),
    [filteredGroups]
  );

  // close on outside click
  useEffect(() => {
    const onDocClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
    if (!open) setFilter('');
  }, [open]);

  useEffect(() => { setHighlight(0); }, [filter]);

  const commit = (option) => {
    onChange(option.value);
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, flatFiltered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (flatFiltered[highlight]) {
        commit(flatFiltered[highlight]);
      } else if (allowCustom && filter.trim()) {
        onChange(filter.trim());
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const totalCount = allOptions.length;

  return (
    <div className="relative" ref={containerRef}>
      {/* The real value for form submission / validation */}
      <input type="hidden" value={value ?? ''} required={required} readOnly />

      <button
        type="button"
        id={id}
        onClick={() => setOpen(o => !o)}
        className="w-full px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-xl text-white text-sm flex items-center justify-between gap-2 text-left focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        <span className={selectedLabel ? 'truncate' : 'truncate text-slate-500'}>
          {selectedLabel || placeholder}
        </span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-700 bg-slate-900">
            <Search className="w-3.5 h-3.5 text-slate-500 shrink-0" />
            <input
              ref={searchRef}
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={searchPlaceholder}
              className="w-full bg-transparent text-white text-xs focus:outline-none placeholder:text-slate-500"
            />
            <span className="text-[10px] text-slate-500 shrink-0">{totalCount}</span>
          </div>

          <div className="max-h-64 overflow-y-auto">
            {filteredGroups.length === 0 && (
              <div className="px-3 py-3 text-xs text-slate-400">
                {allowCustom && filter.trim()
                  ? <>Press Enter to use &ldquo;<span className="text-white">{filter.trim()}</span>&rdquo;</>
                  : emptyMessage}
              </div>
            )}

            {filteredGroups.map(g => (
              <div key={g.group}>
                {g.group && (
                  <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-800/60 sticky top-0">
                    {g.group}
                  </div>
                )}
                {g.options.map(o => {
                  const idx = flatFiltered.indexOf(o);
                  const isSelected = String(o.value) === String(value);
                  return (
                    <button
                      key={`${g.group}-${o.value}`}
                      type="button"
                      onMouseEnter={() => setHighlight(idx)}
                      onClick={() => commit(o)}
                      className={`w-full text-left px-3 py-2 text-xs flex items-start gap-2 ${
                        idx === highlight ? 'bg-slate-800' : ''
                      } ${isSelected ? 'text-brand-300' : 'text-slate-200'}`}
                    >
                      <span className="w-3.5 shrink-0 pt-0.5">
                        {isSelected && <Check className="w-3.5 h-3.5" />}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">{o.label}</span>
                        {o.sublabel && (
                          <span className="block text-[10px] text-slate-500 truncate">{o.sublabel}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          {footer && (
            <div className="border-t border-slate-700 px-3 py-2 bg-slate-900">
              {footer}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
