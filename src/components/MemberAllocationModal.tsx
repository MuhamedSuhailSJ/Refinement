import React, { useEffect, useState } from 'react';
import { X, Plus, Trash2, AlertTriangle } from 'lucide-react';
import {
  ALL_SKILLS,
  Member,
  MemberTeamAllocation,
  SkillTag,
  Team,
} from '../types/scrum';

interface MemberAllocationModalProps {
  isOpen: boolean;
  member: Member | null; // null means adding a new member
  teams: Team[];
  onClose: () => void;
  onSave: (member: Member, isNew: boolean) => void;
}

export const MemberAllocationModal: React.FC<MemberAllocationModalProps> = ({
  isOpen,
  member,
  teams,
  onClose,
  onSave,
}) => {
  const isNew = !member;
  const [name, setName] = useState('');
  const [role, setRole] = useState('Software Engineer');
  const [weeklyCapacityHours, setWeeklyCapacityHours] = useState(40);
  const [skills, setSkills] = useState<SkillTag[]>(['Backend']);
  const [allocations, setAllocations] = useState<MemberTeamAllocation[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (member) {
      setName(member.name);
      setRole(member.role);
      setWeeklyCapacityHours(member.weeklyCapacityHours);
      setSkills(member.skills);
      setAllocations(member.teamAllocations);
    } else {
      setName('');
      setRole('Full-Stack Engineer');
      setWeeklyCapacityHours(40);
      setSkills(['Frontend', 'Backend']);
      setAllocations(teams[0] ? [{ teamId: teams[0].id, allocationPercent: 100 }] : []);
    }
  }, [isOpen, member, teams]);

  if (!isOpen) return null;

  const totalPct = allocations.reduce((sum, a) => sum + Number(a.allocationPercent || 0), 0);

  const toggleSkill = (skill: SkillTag) => {
    setSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const addTeamAllocation = () => {
    const unusedTeam = teams.find((t) => !allocations.some((a) => a.teamId === t.id));
    if (!unusedTeam) return;
    setAllocations((prev) => [...prev, { teamId: unusedTeam.id, allocationPercent: 25 }]);
  };

  const updateAllocation = (index: number, patch: Partial<MemberTeamAllocation>) => {
    setAllocations((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item))
    );
  };

  const removeAllocation = (index: number) => {
    setAllocations((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Member name is required.');
      return;
    }
    if (skills.length === 0) {
      setError('Select at least one skill.');
      return;
    }
    if (allocations.length === 0) {
      setError('Assign at least one squad allocation.');
      return;
    }

    onSave(
      {
        id: member?.id ?? `mem-${Date.now().toString(36)}`,
        name: name.trim(),
        role: role.trim() || 'Engineer',
        weeklyCapacityHours: Math.max(1, Math.min(80, Number(weeklyCapacityHours) || 40)),
        skills,
        teamAllocations: allocations.map((a) => ({
          teamId: a.teamId,
          allocationPercent: Math.max(0, Math.min(200, Number(a.allocationPercent) || 0)),
        })),
      },
      isNew
    );
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="member-modal-title" className="text-base font-semibold text-slate-900">
              {isNew ? 'Add Team Member' : `Configure Capacity · ${member.name}`}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Set skills, weekly capacity hours, and cross-team percentage splits
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close member capacity dialog"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto p-6 space-y-5">
          {error && (
            <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2 space-y-1.5">
              <label htmlFor="mem-name" className="block text-xs font-medium text-slate-700">
                Full Name *
              </label>
              <input
                id="mem-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Jordan Lee"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="mem-hours" className="block text-xs font-medium text-slate-700">
                Weekly Hours *
              </label>
              <input
                id="mem-hours"
                type="number"
                min={8}
                max={80}
                value={weeklyCapacityHours}
                onChange={(e) => setWeeklyCapacityHours(Number(e.target.value))}
                className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="mem-role" className="block text-xs font-medium text-slate-700">
              Role / Discipline
            </label>
            <input
              id="mem-role"
              type="text"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="space-y-2">
            <span className="block text-xs font-medium text-slate-700">Member Skills *</span>
            <div className="flex flex-wrap gap-2">
              {ALL_SKILLS.map((skill) => {
                const active = skills.includes(skill);
                return (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => toggleSkill(skill)}
                    aria-pressed={active}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                      active
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-600 border-slate-300 hover:border-slate-400'
                    }`}
                  >
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-slate-900">
                  Multi-Team Capacity Split
                </span>
                <span className="ml-2 text-xs font-mono text-slate-500">
                  Total: {totalPct}% ({Math.round((weeklyCapacityHours * 2 * totalPct) / 100)}h / sprint)
                </span>
              </div>
              {allocations.length < teams.length && (
                <button
                  type="button"
                  onClick={addTeamAllocation}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add Squad
                </button>
              )}
            </div>

            {totalPct > 100 && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>
                  Over-allocated at {totalPct}%. Consider balancing percentages to 100% or less.
                </span>
              </div>
            )}

            <div className="space-y-2">
              {allocations.map((alloc, index) => (
                <div
                  key={`${alloc.teamId}-${index}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50/70"
                >
                  <select
                    aria-label={`Squad ${index + 1}`}
                    value={alloc.teamId}
                    onChange={(e) => updateAllocation(index, { teamId: e.target.value })}
                    className="flex-1 px-2.5 py-1.5 text-sm bg-white border border-slate-300 rounded-md"
                  >
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      aria-label={`Allocation percentage for squad ${index + 1}`}
                      min={0}
                      max={200}
                      step={5}
                      value={alloc.allocationPercent}
                      onChange={(e) =>
                        updateAllocation(index, { allocationPercent: Number(e.target.value) })
                      }
                      className="w-20 px-2.5 py-1.5 text-sm font-mono text-right bg-white border border-slate-300 rounded-md"
                    />
                    <span className="text-xs font-mono text-slate-500">%</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAllocation(index)}
                    aria-label="Remove squad allocation"
                    disabled={allocations.length <= 1}
                    className="p-1.5 text-slate-400 hover:text-red-600 disabled:opacity-40 rounded-md"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              {isNew ? 'Add Member' : 'Save Capacity'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
