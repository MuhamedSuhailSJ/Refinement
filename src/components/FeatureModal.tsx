import React, { useEffect, useState } from 'react';
import { X, AlertCircle } from 'lucide-react';
import { Feature, FeatureStatus, PriorityLevel, Team } from '../types/scrum';

interface FeatureModalProps {
  isOpen: boolean;
  feature: Feature | null;
  teams: Team[];
  onClose: () => void;
  onSave: (feature: Feature, isNew: boolean) => void;
}

export const FeatureModal: React.FC<FeatureModalProps> = ({
  isOpen,
  feature,
  teams,
  onClose,
  onSave,
}) => {
  const isNew = !feature;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<PriorityLevel>('High');
  const [targetQuarter, setTargetQuarter] = useState('Q4 2026');
  const [teamId, setTeamId] = useState('');
  const [status, setStatus] = useState<FeatureStatus>('Discovery');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    if (feature) {
      setTitle(feature.title);
      setDescription(feature.description);
      setPriority(feature.priority);
      setTargetQuarter(feature.targetQuarter);
      setTeamId(feature.teamId);
      setStatus(feature.status);
    } else {
      setTitle('');
      setDescription('');
      setPriority('High');
      setTargetQuarter('Q4 2026');
      setTeamId(teams[0]?.id ?? '');
      setStatus('Discovery');
    }
  }, [isOpen, feature, teams]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Feature title is required.');
      return;
    }
    if (!teamId) {
      setError('Select an owning squad.');
      return;
    }

    onSave(
      {
        id: feature?.id ?? `feat-${Date.now().toString(36)}`,
        title: title.trim(),
        description: description.trim(),
        priority,
        targetQuarter: targetQuarter.trim() || 'Q4 2026',
        teamId,
        status,
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
      aria-labelledby="feature-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="feature-modal-title" className="text-base font-semibold text-slate-900">
            {isNew ? 'Create Product Feature' : 'Edit Feature'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close feature dialog"
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div role="alert" className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="feat-title" className="block text-xs font-medium text-slate-700">
              Feature Title *
            </label>
            <input
              id="feat-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Unified SSO Gateway"
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="feat-desc" className="block text-xs font-medium text-slate-700">
              Objective & Scope
            </label>
            <textarea
              id="feat-desc"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the customer outcome and delivery milestones..."
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="feat-team" className="block text-xs font-medium text-slate-700">
                Primary Squad *
              </label>
              <select
                id="feat-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="feat-quarter" className="block text-xs font-medium text-slate-700">
                Target Quarter
              </label>
              <input
                id="feat-quarter"
                type="text"
                value={targetQuarter}
                onChange={(e) => setTargetQuarter(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="feat-priority" className="block text-xs font-medium text-slate-700">
                Priority
              </label>
              <select
                id="feat-priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value as PriorityLevel)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="feat-status" className="block text-xs font-medium text-slate-700">
                Feature Status
              </label>
              <select
                id="feat-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as FeatureStatus)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="Discovery">Discovery</option>
                <option value="Refining">Refining</option>
                <option value="Ready">Ready</option>
                <option value="In Delivery">In Delivery</option>
              </select>
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
              {isNew ? 'Create Feature' : 'Save Feature'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
