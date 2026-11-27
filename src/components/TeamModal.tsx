import React, { useEffect, useState } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { Team } from '../types/scrum';

interface TeamModalProps {
  isOpen: boolean;
  team: Team | null;
  teams?: Team[];
  linkedCounts?: { stories: number; features: number; members: number };
  initialConfirmDelete?: boolean;
  onClose: () => void;
  onSave: (team: Team, isNew: boolean) => void;
  onDelete?: (teamId: string, reassignToTeamId?: string) => void;
}

export const TeamModal: React.FC<TeamModalProps> = ({
  isOpen,
  team,
  teams = [],
  linkedCounts = { stories: 0, features: 0, members: 0 },
  initialConfirmDelete = false,
  onClose,
  onSave,
  onDelete,
}) => {
  const isNew = !team;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [leadName, setLeadName] = useState('');
  const [sprintCapacityPoints, setSprintCapacityPoints] = useState(25);
  const [focusArea, setFocusArea] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteMode, setDeleteMode] = useState<'reassign' | 'cascade'>('reassign');
  const [reassignTargetId, setReassignTargetId] = useState('');

  const otherTeams = teams.filter((t) => t.id !== team?.id);

  useEffect(() => {
    if (!isOpen) return;
    if (team) {
      setName(team.name);
      setCode(team.code);
      setLeadName(team.leadName);
      setSprintCapacityPoints(team.sprintCapacityPoints);
      setFocusArea(team.focusArea);
      setConfirmingDelete(initialConfirmDelete);
      const remaining = teams.filter((t) => t.id !== team.id);
      setReassignTargetId(remaining[0]?.id ?? '');
      setDeleteMode(remaining.length > 0 ? 'reassign' : 'cascade');
    } else {
      setName('');
      setCode('');
      setLeadName('');
      setSprintCapacityPoints(25);
      setFocusArea('');
      setConfirmingDelete(false);
      setReassignTargetId('');
      setDeleteMode('reassign');
    }
  }, [isOpen, team, teams, initialConfirmDelete]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave(
      {
        id: team?.id ?? `team-${Date.now().toString(36)}`,
        name: name.trim(),
        code: (code.trim() || name.trim().slice(0, 4)).toUpperCase(),
        leadName: leadName.trim() || 'Unassigned',
        sprintCapacityPoints: Math.max(1, Number(sprintCapacityPoints) || 25),
        focusArea: focusArea.trim() || 'Product Delivery',
      },
      isNew
    );
    onClose();
  };

  const handleConfirmDelete = () => {
    if (!team || !onDelete) return;
    const targetId =
      otherTeams.length > 0 && deleteMode === 'reassign'
        ? reassignTargetId || otherTeams[0].id
        : undefined;
    onDelete(team.id, targetId);
    onClose();
  };

  const hasLinkedWork = linkedCounts.stories > 0 || linkedCounts.features > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-[1px] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="team-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="team-modal-title" className="text-base font-semibold text-slate-900">
            {confirmingDelete && team
              ? `Delete Squad Scope · ${team.name}`
              : isNew
              ? 'Create Scrum Squad'
              : `Edit Squad · ${team.name}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close squad dialog"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {confirmingDelete && team && onDelete ? (
          <div className="p-6 space-y-4">
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 flex items-start gap-2.5 text-xs text-red-900">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">
                  Remove {team.name} ({team.code}) from Squad Scope?
                </p>
                <p className="text-red-800">
                  This updates {linkedCounts.members} member allocation
                  {linkedCounts.members === 1 ? '' : 's'} and affects {linkedCounts.features}{' '}
                  feature{linkedCounts.features === 1 ? '' : 's'} and {linkedCounts.stories}{' '}
                  stor{linkedCounts.stories === 1 ? 'y' : 'ies'}.
                </p>
              </div>
            </div>

            {hasLinkedWork && otherTeams.length > 0 && (
              <div className="space-y-2.5">
                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="squad-delete-mode"
                    checked={deleteMode === 'reassign'}
                    onChange={() => setDeleteMode('reassign')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-600"
                  />
                  <div className="flex-1 space-y-2">
                    <span className="block text-xs font-medium text-slate-900">
                      Reassign linked features &amp; stories to another squad
                    </span>
                    <select
                      aria-label="Target squad for reassigned work"
                      value={reassignTargetId}
                      onChange={(e) => {
                        setDeleteMode('reassign');
                        setReassignTargetId(e.target.value);
                      }}
                      disabled={deleteMode !== 'reassign'}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 disabled:opacity-60"
                    >
                      {otherTeams.map((ot) => (
                        <option key={ot.id} value={ot.id}>
                          {ot.name} ({ot.code})
                        </option>
                      ))}
                    </select>
                  </div>
                </label>

                <label className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 bg-white cursor-pointer">
                  <input
                    type="radio"
                    name="squad-delete-mode"
                    checked={deleteMode === 'cascade'}
                    onChange={() => setDeleteMode('cascade')}
                    className="mt-0.5 text-red-600 focus:ring-red-600"
                  />
                  <span className="text-xs font-medium text-slate-700">
                    Delete squad and permanently remove its {linkedCounts.features} features &amp;{' '}
                    {linkedCounts.stories} stories
                  </span>
                </label>
              </div>
            )}

            {hasLinkedWork && otherTeams.length === 0 && (
              <p className="text-xs text-slate-600">
                No other squads remain. Deleting this squad will also remove its{' '}
                {linkedCounts.features} feature{linkedCounts.features === 1 ? '' : 's'} and{' '}
                {linkedCounts.stories} stor{linkedCounts.stories === 1 ? 'y' : 'ies'}.
              </p>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => (initialConfirmDelete ? onClose() : setConfirmingDelete(false))}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
              >
                {initialConfirmDelete ? 'Cancel' : 'Back'}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirm Delete Squad
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1.5">
                <label htmlFor="team-name" className="block text-xs font-medium text-slate-700">
                  Squad Name *
                </label>
                <input
                  id="team-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Security & Trust"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="team-code" className="block text-xs font-medium text-slate-700">
                  Code
                </label>
                <input
                  id="team-code"
                  type="text"
                  maxLength={8}
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="SEC"
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="team-lead" className="block text-xs font-medium text-slate-700">
                  Scrum / Tech Lead
                </label>
                <input
                  id="team-lead"
                  type="text"
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="Lead name"
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="team-cap" className="block text-xs font-medium text-slate-700">
                  Sprint Target (pts)
                </label>
                <input
                  id="team-cap"
                  type="number"
                  min={1}
                  max={300}
                  value={sprintCapacityPoints}
                  onChange={(e) => setSprintCapacityPoints(Number(e.target.value))}
                  className="w-full px-3 py-2 text-sm font-mono bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="team-focus" className="block text-xs font-medium text-slate-700">
                Domain Focus Area
              </label>
              <input
                id="team-focus"
                type="text"
                value={focusArea}
                onChange={(e) => setFocusArea(e.target.value)}
                placeholder="e.g., Auth, Audit Logs & Compliance"
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-200">
              <div>
                {!isNew && onDelete && (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete Squad
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2.5">
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
                  {isNew ? 'Create Squad' : 'Save Squad'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

