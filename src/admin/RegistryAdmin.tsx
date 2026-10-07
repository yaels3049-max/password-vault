import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createGlobalRegistryRow,
  disableGlobalRegistryRow,
  fetchAdminCategories,
  fetchAdminNoteServiceIds,
  fetchAllRegistryRowsForAdmin,
  fetchRegistryRowForAdmin,
  updateGlobalRegistryRow,
  updateUserOwnedRegistryRow,
  updateIconMetadata,
  uploadAdminIconFile,
  adminRefreshServiceIcon,
  adminRefreshLoginIntelligence,
  adminOverrideLoginIntelligence,
  adminDeleteService,
  fetchServiceDeleteImpact,
  type AdminCategory,
  type AdminRegistryRow,
  type GlobalRegistryInput,
} from './adminRegistryApi';
import DeleteServiceDialog, { DELETE_SERVICE_COPY_HE } from './DeleteServiceDialog';
import { loadSubmitterProfiles, type SubmitterProfileMap } from './submitterProfiles';
import { withoutAutofillProfile, withoutLoginContractKeys } from './contractSafeMetadata';
import {
  addedByLabel,
  dedicatedLoginUrlOrNull,
  formatAdminDate,
  sourceFilterKind,
  sourceKindLabelHe,
  statusLabelHe,
} from './adminPresentation';
import { deriveRegistryServiceIdFromUrl } from '../registry/serviceIdFromUrl';
import IconAssetEditor from './IconAssetEditor';
import IntegrationStatusPanel from './IntegrationStatusPanel';
import AutofillProfileEditor from './AutofillProfileEditor';
import AdminFillTestGrid from './AdminFillTestGrid';
import {
  savedAuthoringPattern,
  type ManagedGridSharedState,
  type SpecialDraftDirtyState,
} from './fillTestContext';
import LoginPatternGrid from './LoginPatternGrid';
import SpecialLoginDraftEditor from './SpecialLoginDraftEditor';
import { isSpecialLoginPattern, type AuthoringLoginPattern } from '../loginContract';
import LoginIntelligencePanel from './LoginIntelligencePanel';
import UrlFieldWithCopy from './UrlFieldWithCopy';
import CredentialFieldsEditor, {
  editorFieldsFromStored,
  editorFieldsToStored,
  type CredentialFieldChange,
  type EditorCredentialField,
} from './CredentialFieldsEditor';
import { useAdminConfirm, type AdminConfirmOptions } from './AdminConfirmDialog';
import { PATTERN_CHANGE_DIALOG, patternChangeNeedsWarning } from './patternChange';
import { adminRowToLogoService } from './adminLogoService';
import { useServiceLogos } from '../useServiceLogos';
import {
  ADMIN_DIRECT_URL_LABEL,
  ADMIN_PRIMARY_PAGE_LABEL,
  EMPTY_LOGIN_URL_MESSAGE,
  INVALID_LOGIN_URL_MESSAGE,
  defaultLoginEntryType,
  isExplicitHttpUrl,
  resolveExplicitLoginEntry,
  type ExplicitLoginEntryType,
} from '../catalog/explicitLoginEntry';
import {
  ADMIN_MODE_CREDENTIAL_FIELDS_LABEL,
  ADMIN_MODE_NO_STORED_LABEL,
  ADMIN_MODE_NOT_CONFIGURED_LABEL,
  ADMIN_NO_STORED_HINT,
  ADMIN_SCHEMA_NOT_CONFIGURED,
  MODE_CLEAR_WARNING,
  classifyStoredLoginFields,
  readStoredCredentialMode,
  type CredentialMode,
} from '../service/credentialSchema';
import {
  ADMIN_WORKSPACE_HE,
  WORKSPACE_LAYOUT_HE,
  WORKSPACE_TABS,
  WORKSPACE_TAB_DESCRIPTION_HE,
  WORKSPACE_TAB_HE,
  confirmLeaveWorkspace,
  leaveWorkspaceDialog,
  statusBadgeClass,
  registryRowMatches,
  serviceFormSnapshot,
  workspaceDirty,
  workspaceTabEnabled,
  type WorkspaceTab,
} from './adminWorkspace';
import MappingStatusLine from './MappingStatusLine';
import { specialMappingStatus, standardMappingStatus } from './mappingStatus';
import { AdminEmptyState, IconInfo, IconKey, IconNote, IconPlay, IconPlus, IconSearchEmpty, IconWarning } from './adminIcons';
import AdminChipRow from './AdminChipRow';
import AdminNotesPanel from './AdminNotesPanel';
import UserApprovalBadge from './UserApprovalBadge';
import { USER_APPROVAL_HE, userApprovalState, type UserApprovalState } from './userApproval';

const WORKSPACE_TAB_ICONS: Record<WorkspaceTab, ReactNode> = {
  details: <IconInfo />,
  login: <IconKey />,
  test: <IconPlay />,
  notes: <IconNote />,
};

const EMPTY_FORM: GlobalRegistryInput = {
  display_name: '',
  primary_url: '',
  login_url: '',
  category_id: null,
  icon: '🔗',
  adapter_id: '',
  source_type: 'admin',
  service_status: 'active',
};

type SourceFilter = 'all' | 'built_in' | 'custom' | 'user_submitted';
type StatusFilter = 'all' | 'active' | 'inactive';
/** O-123-32 — the card badge's approval state (userApprovalState), or all. */
type ApprovalFilter = 'all' | UserApprovalState;
const APPROVAL_FILTER_STATES: UserApprovalState[] = ['approved', 'not_approved', 'blocked', 'no_mapping'];

function SiteIcon({
  row,
  logoSrc,
}: {
  row: AdminRegistryRow;
  logoSrc?: string | null;
}) {
  if (logoSrc) {
    return (
      <img className="admin-site-card-icon" src={logoSrc} alt="" width={40} height={40} />
    );
  }
  const emoji =
    row.icon &&
    row.icon.trim() &&
    !/^https?:/i.test(row.icon) &&
    row.icon.trim() !== '🔗'
      ? row.icon.trim()
      : null;
  return (
    <span className="admin-site-card-icon admin-site-card-icon--letter" aria-hidden>
      {emoji ?? row.display_name.slice(0, 1)}
    </span>
  );
}

interface RegistryAdminProps {
  /** Phase 122 — unsaved service form / SPECIAL draft (the Admin nav asks before leaving). */
  onDirtyChange?: (dirty: boolean) => void;
}

export default function RegistryAdmin({ onDirtyChange }: RegistryAdminProps = {}) {
  const [rows, setRows] = useState<AdminRegistryRow[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<AdminRegistryRow | null>(null);
  // Live «אופי הכניסה» selection (not persisted), keyed by row to avoid carry-over.
  const [authoringPatternSelection, setAuthoringPatternSelection] = useState<{
    rowId: string;
    pattern: AuthoringLoginPattern;
  } | null>(null);
  const selectedRowId = selectedRow?.id ?? null;
  // Phase 122.5 R2 — the pattern chooser is closed until «שינוי אופי הכניסה» (per row).
  const [patternChooserRowId, setPatternChooserRowId] = useState<string | null>(null);
  const patternChooserOpen = patternChooserRowId !== null && patternChooserRowId === selectedRowId;
  const onAuthoringPatternSelected = useCallback(
    (pattern: AuthoringLoginPattern) => {
      if (selectedRowId) setAuthoringPatternSelection({ rowId: selectedRowId, pattern });
      setPatternChooserRowId(null);
    },
    [selectedRowId],
  );
  const { ask, dialog: confirmDialog } = useAdminConfirm();
  // D-121-45: the «אופי הכניסה» grid owns the selection; untouched → the saved pattern.
  const selectedAuthoringPattern: AuthoringLoginPattern | null =
    authoringPatternSelection !== null && authoringPatternSelection.rowId === selectedRowId
      ? authoringPatternSelection.pattern
      : selectedRow
        ? savedAuthoringPattern(selectedRow.metadata)
        : null;
  const specialPatternSelected =
    selectedAuthoringPattern !== null && isSpecialLoginPattern(selectedAuthoringPattern);
  const [specialSelectorLock, setSpecialSelectorLock] = useState<{ rowId: string; locked: boolean } | null>(null);
  // D-121-38: «בדיקת מילוי» observes the managed grid; the managed grid locks while a test runs.
  const [managedGridState, setManagedGridState] = useState<ManagedGridSharedState | null>(null);
  const patternSelectorLocked = specialPatternSelected
    ? specialSelectorLock?.rowId === selectedRowId && specialSelectorLock.locked
    : managedGridState?.rowId === selectedRowId && managedGridState.busy;
  const [fillTestRunning, setFillTestRunning] = useState(false);
  const [specialDraftDirty, setSpecialDraftDirty] = useState<SpecialDraftDirtyState | null>(null);
  const [form, setForm] = useState<GlobalRegistryInput>(EMPTY_FORM);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loginEntryType, setLoginEntryType] = useState<ExplicitLoginEntryType>('primary_page');
  const [credentialFields, setCredentialFields] = useState<EditorCredentialField[]>([]);
  const [credentialMode, setCredentialMode] = useState<CredentialMode>('not_configured');
  const [configurationTouched, setConfigurationTouched] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; displayName: string } | null>(null);
  const [submitters, setSubmitters] = useState<SubmitterProfileMap>({});
  const [noteIds, setNoteIds] = useState<ReadonlySet<string>>(new Set());
  const [notesDirty, setNotesDirty] = useState<{ rowId: string; dirty: boolean } | null>(null);
  const onNoteSaved = useCallback((serviceId: string, hasNote: boolean) => {
    setNoteIds((current) => {
      const next = new Set(current);
      if (hasNote) next.add(serviceId);
      else next.delete(serviceId);
      return next;
    });
  }, []);

  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSource, setFilterSource] = useState<SourceFilter>('all');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterApproval, setFilterApproval] = useState<ApprovalFilter>('all');
  // Phase 122 — service form state as loaded / last saved (unsaved-changes guard only).
  const [formBaseline, setFormBaseline] = useState<string | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [switcherQuery, setSwitcherQuery] = useState('');
  // Tabs only hide panels (`hidden`); every editor stays mounted across tab switches.
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('details');
  const [categoryError, setCategoryError] = useState(false);
  const [categoryFocusRequest, setCategoryFocusRequest] = useState(0);
  const categorySelectRef = useRef<HTMLSelectElement | null>(null);
  useEffect(() => {
    if (categoryFocusRequest > 0) categorySelectRef.current?.focus();
  }, [categoryFocusRequest]);

  const logoServices = useMemo(() => rows.map(adminRowToLogoService), [rows]);
  const logos = useServiceLogos(logoServices);

  const categoryLabel = useCallback(
    (categoryId: string | null | undefined) => {
      if (!categoryId) return 'ללא קטגוריה';
      return categories.find((c) => c.id === categoryId)?.display_name ?? categoryId;
    },
    [categories],
  );

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [registryRows, categoryRows] = await Promise.all([
        fetchAllRegistryRowsForAdmin(),
        fetchAdminCategories(),
      ]);
      setRows(registryRows);
      setCategories(categoryRows);
      setSubmitters(await loadSubmitterProfiles(registryRows));
      // 122.8 R4: markers only; a failure shows no markers and never blocks the catalog.
      setNoteIds(new Set(await fetchAdminNoteServiceIds().catch(() => [] as string[])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'טעינת קטלוג נכשלה.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!selectedId) {
      setSelectedRow(null);
      return;
    }

    void (async () => {
      try {
        const row = await fetchRegistryRowForAdmin(selectedId);
        setSelectedRow(row);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'טעינת אתר נכשלה.');
      }
    })();
  }, [selectedId, rows]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (filterCategory && row.category_id !== filterCategory) return false;
      if (filterSource !== 'all' && sourceFilterKind(row) !== filterSource) return false;
      if (filterStatus === 'active' && row.service_status !== 'active') return false;
      if (
        filterStatus === 'inactive' &&
        row.service_status !== 'disabled' &&
        row.service_status !== 'deprecated'
      ) {
        return false;
      }
      if (filterApproval !== 'all' && userApprovalState(row) !== filterApproval) return false;
      return registryRowMatches(row, search, categoryLabel);
    });
  }, [rows, search, filterCategory, filterSource, filterStatus, filterApproval, categoryLabel]);

  const switcherRows = useMemo(
    () => rows.filter((row) => registryRowMatches(row, switcherQuery, categoryLabel)),
    [rows, switcherQuery, categoryLabel],
  );

  function startCreate() {
    const nextForm: GlobalRegistryInput = { ...EMPTY_FORM };
    setCategoryError(false);
    setIsCreating(true);
    setSelectedId(null);
    setSelectedRow(null);
    setShowMoreDetails(false);
    setWorkspaceTab('details');
    setLoginEntryType('primary_page');
    setCredentialFields([]);
    setCredentialMode('not_configured');
    setConfigurationTouched(false);
    setForm(nextForm);
    setFormBaseline(
      serviceFormSnapshot({
        form: nextForm,
        loginEntryType: 'primary_page',
        credentialMode: 'not_configured',
        credentialFields: [],
      }),
    );
  }

  function startEdit(row: AdminRegistryRow) {
    setCategoryError(false);
    setIsCreating(false);
    setSelectedId(row.id);
    setShowMoreDetails(false);
    setWorkspaceTab('details');
    const entryType = defaultLoginEntryType(
      row.login_url,
      row.primary_url,
      row.metadata?.loginEntryType,
    );
    setLoginEntryType(entryType);
    const storedSchema = classifyStoredLoginFields(row.login_fields);
    const storedMode = readStoredCredentialMode(row.metadata);
    const nextFields =
      storedSchema.status === 'valid' ? editorFieldsFromStored(storedSchema.fields) : [];
    const nextMode: CredentialMode =
      storedMode === 'credential_fields' ||
      storedMode === 'no_stored_credentials' ||
      storedMode === 'not_configured'
        ? storedMode
        : storedSchema.status === 'valid'
          ? 'credential_fields'
          : 'not_configured';
    setCredentialFields(nextFields);
    setCredentialMode(nextMode);
    setConfigurationTouched(false);
    const nextForm: GlobalRegistryInput = {
      id: row.id,
      display_name: row.display_name,
      primary_url: row.primary_url,
      login_url: entryType === 'direct_url' ? (row.login_url ?? '') : row.primary_url,
      category_id: row.category_id,
      icon: row.icon,
      adapter_id: row.adapter_id,
      source_type: row.source_type as GlobalRegistryInput['source_type'],
      service_status: row.service_status as GlobalRegistryInput['service_status'],
      login_url_status: 'valid',
      metadata: row.metadata ?? {},
    };
    setForm(nextForm);
    setFormBaseline(
      serviceFormSnapshot({
        form: nextForm,
        loginEntryType: entryType,
        credentialMode: nextMode,
        credentialFields: nextFields,
      }),
    );
  }

  async function handleCredentialModeChange(next: CredentialMode) {
    if (
      (next === 'no_stored_credentials' || next === 'not_configured') &&
      credentialFields.length > 0 &&
      savedFieldIdsInUse.length > 0 &&
      !(await ask(modeClearDialog()))
    ) {
      return;
    }
    if (next === 'no_stored_credentials' || next === 'not_configured') {
      setCredentialFields([]);
    }
    setCredentialMode(next);
    setConfigurationTouched(true);
  }

  function cancelEdit() {
    setIsCreating(false);
    setSelectedId(null);
    setSelectedRow(null);
    setShowMoreDetails(false);
    setForm(EMPTY_FORM);
    setLoginEntryType('primary_page');
    setFormBaseline(null);
    setSwitcherOpen(false);
  }

  // Phase 122.5 R4 — field ids users may already have values for: last saved login_fields of
  // an active global site. Only these ask before remove / id change / mode clear.
  const savedFieldIdsInUse = useMemo<string[]>(() => {
    if (!selectedRow || isCreating || selectedRow.owner_user_id != null || selectedRow.service_status !== 'active') {
      return [];
    }
    const stored = classifyStoredLoginFields(selectedRow.login_fields);
    return stored.status === 'valid' ? stored.fields.map((field) => field.id) : [];
  }, [selectedRow, isCreating]);

  function modeClearDialog(): AdminConfirmOptions {
    return {
      name: 'credential-mode-clear',
      title: 'למחוק את הגדרת שדות הכניסה?',
      body: MODE_CLEAR_WARNING,
      confirmLabel: 'מחיקת ההגדרה',
      tone: 'danger',
    };
  }

  function confirmFieldChange(change: CredentialFieldChange, message: string): Promise<boolean> {
    return ask({
      name: change === 'remove' ? 'credential-field-remove' : 'credential-field-id',
      title: change === 'remove' ? 'להסיר שדה שכבר בשימוש?' : 'לשנות מזהה של שדה שכבר בשימוש?',
      body: message,
      confirmLabel: change === 'remove' ? 'הסרה' : 'שינוי המזהה',
      tone: 'danger',
    });
  }

  const formSnapshot = serviceFormSnapshot({ form, loginEntryType, credentialMode, credentialFields });
  // A finished save without an error is the new baseline (the save path itself is untouched).
  const wasSavingRef = useRef(false);
  useEffect(() => {
    if (wasSavingRef.current && !saving && error === null) setFormBaseline(formSnapshot);
    wasSavingRef.current = saving;
  }, [saving, error, formSnapshot]);

  const dirty = workspaceDirty({
    editing: Boolean(isCreating || selectedId),
    formSnapshot,
    formBaseline,
    rowId: selectedRowId,
    specialDraftDirty,
    notesDirty,
  });
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  // R1: the save bar lives on «פרטי אתר»; other tabs point back to it while the form is dirty.
  const detailsUnsavedElsewhere =
    workspaceTab !== 'details' && formBaseline !== null && formSnapshot !== formBaseline;

  function confirmLeaveSite(): Promise<boolean> {
    return confirmLeaveWorkspace(dirty, (message) => ask(leaveWorkspaceDialog(message)));
  }

  async function leaveToCatalog() {
    if (!(await confirmLeaveSite())) return;
    cancelEdit();
  }

  async function switchToRow(row: AdminRegistryRow) {
    setSwitcherOpen(false);
    if (row.id === selectedId && !isCreating) return;
    if (!(await confirmLeaveSite())) return;
    startEdit(row);
  }

  function resolvedAdminEntry() {
    return resolveExplicitLoginEntry({
      websiteUrl: form.primary_url,
      sameAsWebsite: loginEntryType === 'primary_page',
      dedicatedLoginUrl: form.login_url,
    });
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!form.category_id) {
      setCategoryError(true);
      setWorkspaceTab('details');
      setCategoryFocusRequest((n) => n + 1);
      return;
    }

    let entry: ReturnType<typeof resolveExplicitLoginEntry>;
    try {
      if (loginEntryType === 'direct_url') {
        const dedicated = form.login_url?.trim() ?? '';
        if (!dedicated) {
          throw new Error(EMPTY_LOGIN_URL_MESSAGE);
        }
        if (!isExplicitHttpUrl(dedicated)) {
          throw new Error(INVALID_LOGIN_URL_MESSAGE);
        }
      }
      entry = resolvedAdminEntry();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה.');
      return;
    }

    const publishConfiguration = isCreating || configurationTouched;
    let fieldsForSave = credentialFields;
    if (
      publishConfiguration &&
      (credentialMode === 'no_stored_credentials' || credentialMode === 'not_configured') &&
      credentialFields.length > 0
    ) {
      if (savedFieldIdsInUse.length > 0 && !(await ask(modeClearDialog()))) {
        return;
      }
      fieldsForSave = [];
      setCredentialFields([]);
    }
    const storedFields = editorFieldsToStored(fieldsForSave);
    if (credentialMode === 'credential_fields' && storedFields.some((field) => !field.label)) {
      setError('יש להזין תווית לכל שדה כניסה.');
      return;
    }

    const metadata: Record<string, unknown> = {
      ...withoutLoginContractKeys(form.metadata),
      loginEntryType: entry.loginEntryType,
      loginUrlSource: isCreating || selectedRow?.owner_user_id == null ? 'admin' : 'user',
    };
    if (publishConfiguration && (isCreating || selectedRow?.owner_user_id == null)) {
      metadata.credentialMode = credentialMode;
    }
    // D-121-65: an edit never re-writes the STANDARD mapping — the stored profile is kept as is.
    const editMetadata = withoutAutofillProfile(metadata);

    try {
      setSaving(true);
      if (isCreating) {
        const serviceId = await createGlobalRegistryRow({
          ...form,
          login_url: entry.loginUrl,
          login_url_status: 'valid',
          login_fields: credentialMode === 'credential_fields' ? storedFields : null,
          credential_mode: credentialMode,
          metadata,
        });
        setIsCreating(false);
        setSelectedId(serviceId);
        setSuccess('האתר נוצר.');
      } else if (selectedId) {
        if (selectedRow?.owner_user_id != null) {
          await updateUserOwnedRegistryRow(selectedId, {
            display_name: form.display_name,
            primary_url: form.primary_url,
            login_url: entry.loginUrl,
            category_id: form.category_id,
            service_status: form.service_status,
            metadata: editMetadata,
          });
          setSuccess('הגשת המשתמש עודכנה.');
        } else {
          await updateGlobalRegistryRow(selectedId, {
            display_name: form.display_name,
            primary_url: form.primary_url,
            login_url: entry.loginUrl,
            category_id: form.category_id,
            icon: form.icon,
            adapter_id: form.adapter_id || null,
            source_type: form.source_type,
            service_status: form.service_status,
            login_url_status: 'valid',
            metadata: editMetadata,
            ...(configurationTouched
              ? {
                  login_fields: credentialMode === 'credential_fields' ? storedFields : null,
                  credential_mode: credentialMode,
                }
              : {}),
          });
          setSuccess('האתר עודכן.');
        }
      }

      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שמירה נכשלה.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDisable(serviceId: string) {
    if (selectedRow?.owner_user_id != null) {
      setError('לא ניתן להשבית כאן אתר בבעלות משתמש. השתמשו באישור או דחייה בתור ההגשות.');
      return;
    }
    const confirmed = await ask({
      name: 'disable-site',
      title: 'להשבית את האתר הזה?',
      confirmLabel: 'השבתה',
      tone: 'danger',
    });
    if (!confirmed) {
      return;
    }

    setError(null);
    try {
      await disableGlobalRegistryRow(serviceId);
      setSuccess('האתר הושבת.');
      await reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'השבתה נכשלה.');
    }
  }

  async function requestPatternChange() {
    if (!selectedRow || patternSelectorLocked) return;
    if (patternChooserOpen) {
      setPatternChooserRowId(null);
      return;
    }
    const rowId = selectedRow.id;
    if (patternChangeNeedsWarning(selectedRow.metadata) && !(await ask(PATTERN_CHANGE_DIALOG))) return;
    setPatternChooserRowId(rowId);
  }

  const editing = isCreating || selectedId;
  const isUserOwnedRow =
    !isCreating && selectedRow != null && selectedRow.owner_user_id != null;
  const testTabMappingStatus = !selectedRow
    ? null
    : specialPatternSelected
      ? specialMappingStatus(selectedRow.metadata)
      : standardMappingStatus(selectedRow.metadata);
  const managedGridsMounted =
    credentialMode === 'credential_fields' && selectedRow?.owner_user_id === null && !isCreating;

  return (
    <section
      className={`admin-section admin-section--registry ${editing ? 'is-workspace' : 'is-catalog'}`}
      data-mode={editing ? 'workspace' : 'catalog'}
    >
      {!editing ? (
        <header className="admin-section-header">
          <h2>{ADMIN_WORKSPACE_HE.catalogTitle}</h2>
          <p>
            קטלוג מלא של אתרים (מובנים, מנהל, והגשות משתמשים) — ללא גישה לפרטי כניסה של משתמשים.
            השתמשו בסינון לפי מקור וסטטוס.
          </p>
        </header>
      ) : null}

      {loading && <p className="admin-muted">טוען…</p>}
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <p className="admin-success" role="status">
          {success}
        </p>
      )}

      {!editing ? (
        <>
      <div className="admin-catalog-bar">
      <div className="admin-toolbar">
        <button type="button" className="admin-btn admin-btn-primary admin-new-site-btn" data-action="new-site" onClick={startCreate}>
          <IconPlus />
          {ADMIN_WORKSPACE_HE.newSite}
        </button>
      </div>

      <div className="admin-filters" role="search">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי שם, קטגוריה או כתובת כניסה"
          aria-label="חיפוש אתרים"
        />
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          aria-label="סינון לפי קטגוריה"
        >
          <option value="">כל הקטגוריות</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.display_name}
            </option>
          ))}
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value as SourceFilter)}
          aria-label="סינון לפי מקור"
        >
          <option value="all">כל המקורות</option>
          <option value="built_in">מובנה</option>
          <option value="custom">מותאם / מנהל</option>
          <option value="user_submitted">הוגש על ידי משתמש</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
          aria-label="סינון לפי סטטוס"
        >
          <option value="all">כל הסטטוסים</option>
          <option value="active">פעיל</option>
          <option value="inactive">לא פעיל</option>
        </select>
        <select
          value={filterApproval}
          onChange={(e) => setFilterApproval(e.target.value as ApprovalFilter)}
          aria-label="סינון לפי מצב אישור"
          data-filter="approval"
        >
          <option value="all">כל מצבי האישור</option>
          {APPROVAL_FILTER_STATES.map((state) => (
            <option key={state} value={state}>
              {USER_APPROVAL_HE[state]}
            </option>
          ))}
        </select>
      </div>
      </div>

        <div
          className="admin-catalog admin-scroll-panel"
          aria-label="רשימת אתרים"
          data-part="catalog"
        >
          <ul className="admin-card-grid">
            {filteredRows.map((row) => (
              <li key={row.id} className="admin-card-cell">
                <button
                  type="button"
                  className={`admin-site-card${selectedId === row.id ? ' is-active' : ''}`}
                  data-card-id={row.id}
                  onClick={() => startEdit(row)}
                >
                  <div className="admin-site-card-top">
                    <UserApprovalBadge row={row} />
                  </div>
                  <div className="admin-site-card-head">
                    <SiteIcon row={row} logoSrc={logos[row.id]} />
                    <div className="admin-site-card-name" title={row.display_name}>
                      {row.display_name}
                    </div>
                  </div>
                  <div className="admin-site-card-meta">
                    <AdminChipRow
                      chips={[
                        { key: 'category', label: categoryLabel(row.category_id) },
                        { key: 'source', label: sourceKindLabelHe(row), className: 'admin-badge--muted' },
                        {
                          key: 'status',
                          label: statusLabelHe(row.service_status),
                          className: statusBadgeClass(row.service_status),
                        },
                      ]}
                    />
                  </div>
                  <div className="admin-site-card-footer" data-part="card-footer">
                    <p className="admin-site-card-line">
                      <strong>נוסף:</strong> {formatAdminDate(row.created_at)} ·{' '}
                      <strong>על ידי:</strong>{' '}
                      <span data-part="added-by">
                        {addedByLabel(row, row.owner_user_id ? submitters[row.owner_user_id] : undefined)}
                      </span>
                    </p>
                    {noteIds.has(row.id) ? (
                      <span className="admin-note-marker" data-marker="has-note">
                        <IconNote size={14} />
                        יש הערה
                      </span>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
          {!loading && filteredRows.length === 0 && (
            <AdminEmptyState icon={<IconSearchEmpty size={28} />}>{WORKSPACE_LAYOUT_HE.catalogEmpty}</AdminEmptyState>
          )}
        </div>
        </>
      ) : null}

      {editing ? (
        <div className="admin-workspace" data-part="workspace">
          <div className="admin-site-strip" data-part="site-strip">
            <div className="admin-site-strip-identity">
              {selectedRow && !isCreating ? (
                <SiteIcon row={selectedRow} logoSrc={logos[selectedRow.id]} />
              ) : (
                <span className="admin-site-card-icon admin-site-card-icon--letter" aria-hidden>
                  +
                </span>
              )}
              <div className="admin-site-strip-text">
                <div className="admin-site-strip-name" data-part="site-name">
                  {isCreating ? ADMIN_WORKSPACE_HE.newSite : (selectedRow?.display_name ?? '…')}
                </div>
                {selectedRow && !isCreating ? (
                  <>
                    <UserApprovalBadge row={selectedRow} size="lg" />
                    <span
                      className={`admin-badge ${statusBadgeClass(selectedRow.service_status)}`}
                      data-status="site-status"
                    >
                      {statusLabelHe(selectedRow.service_status)}
                    </span>
                  </>
                ) : null}
              </div>
            </div>
            <div className="admin-site-strip-actions">
              <div className="admin-site-switcher">
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  data-action="site-switcher"
                  aria-haspopup="listbox"
                  aria-expanded={switcherOpen}
                  onClick={() => setSwitcherOpen((open) => !open)}
                >
                  {ADMIN_WORKSPACE_HE.switchSite} ▾
                </button>
                {switcherOpen ? (
                  <div
                    className="admin-site-switcher-panel"
                    data-panel="site-switcher"
                    onKeyDown={(event) => {
                      if (event.key === 'Escape') setSwitcherOpen(false);
                    }}
                  >
                    <input
                      type="search"
                      value={switcherQuery}
                      onChange={(e) => setSwitcherQuery(e.target.value)}
                      placeholder={ADMIN_WORKSPACE_HE.switchSearch}
                      aria-label={ADMIN_WORKSPACE_HE.switchSearch}
                      autoFocus
                    />
                    <ul className="admin-site-switcher-list" role="listbox" aria-label={ADMIN_WORKSPACE_HE.switchSite}>
                      {switcherRows.map((row) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            role="option"
                            aria-selected={row.id === selectedId}
                            className={`admin-site-switcher-item${row.id === selectedId ? ' is-active' : ''}`}
                            data-action="switch-site"
                            data-row-id={row.id}
                            onClick={() => void switchToRow(row)}
                          >
                            <SiteIcon row={row} logoSrc={logos[row.id]} />
                            <span className="admin-site-switcher-name">{row.display_name}</span>
                            <span className={`admin-badge ${statusBadgeClass(row.service_status)}`}>
                              {statusLabelHe(row.service_status)}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                    {switcherRows.length === 0 ? (
                      <p className="admin-muted">{ADMIN_WORKSPACE_HE.switchEmpty}</p>
                    ) : null}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="admin-btn admin-btn-secondary"
                data-action="back-to-catalog"
                onClick={() => void leaveToCatalog()}
              >
                {ADMIN_WORKSPACE_HE.backToCatalog}
              </button>
            </div>
          </div>

          <div className="admin-workspace-tabs" role="tablist" aria-label="עריכת אתר" data-part="workspace-tabs">
            {WORKSPACE_TABS.map((tab) => {
              const enabled = workspaceTabEnabled(tab.id, isCreating);
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  id={`admin-tab-${tab.id}`}
                  aria-controls={`admin-tabpanel-${tab.id}`}
                  aria-selected={workspaceTab === tab.id}
                  className={`admin-workspace-tab${workspaceTab === tab.id ? ' is-active' : ''}`}
                  data-tab={tab.id}
                  disabled={!enabled}
                  title={enabled ? undefined : WORKSPACE_TAB_HE.createOnlyHint}
                  onClick={() => setWorkspaceTab(tab.id)}
                >
                  {WORKSPACE_TAB_ICONS[tab.id]}
                  {tab.label}
                </button>
              );
            })}
            {isCreating ? (
              <span className="admin-field-hint" data-hint="create-only-tabs">
                {WORKSPACE_TAB_HE.createOnlyHint}
              </span>
            ) : null}
          </div>

          <div className="admin-workspace-body admin-scroll-panel" aria-label="עריכת אתר" data-active-tab={workspaceTab}>
          {/* 12-column grid. The service form is `display: contents`, so its panels and the save bar
              share this grid with the side stack, which stays outside the form (it has its own forms). */}
          <div
            className={`admin-workspace-columns${
              workspaceTab === 'details' && !isCreating && selectedRow ? ' has-aside' : ''
            }`}
          >
          {editing && (
            <form
              className="admin-edit-shell"
              onSubmit={(event) => void handleSave(event)}
              onInvalid={() => setWorkspaceTab('details')}
            >
              {workspaceTab !== 'test' || detailsUnsavedElsewhere ? (
              <header className="admin-workspace-head">
                {/* O-123-31 — «בדיקה והפעלה» has no heading or description line. */}
                {workspaceTab !== 'test' ? (
                  <>
                    <h3>
                      {isCreating
                        ? 'יצירת אתר'
                        : isUserOwnedRow
                          ? 'פרטי אתר (הגשת משתמש)'
                          : 'עריכת אתר'}
                    </h3>
                    <p className="admin-section-desc">{WORKSPACE_TAB_DESCRIPTION_HE[workspaceTab]}</p>
                  </>
                ) : null}
                {detailsUnsavedElsewhere ? (
                  <p className="admin-unsaved-notice" role="status" data-notice="details-unsaved">
                    <IconWarning />
                    <span>{ADMIN_WORKSPACE_HE.detailsUnsaved}</span>
                    <button
                      type="button"
                      className="admin-link-btn"
                      data-action="go-to-details"
                      onClick={() => setWorkspaceTab('details')}
                    >
                      {ADMIN_WORKSPACE_HE.detailsUnsavedLink}
                    </button>
                  </p>
                ) : null}
              </header>
              ) : null}

              {isUserOwnedRow && (
                <p className="admin-field-hint admin-workspace-notice" role="status">
                  זו הגשה בבעלות משתמש — ניתן לערוך את השדות ולשמור. לאישור או דחייה עברו ל-
                  «אתרים בהוספה ע&quot;י משתמשים».
                </p>
              )}

              <div
                role="tabpanel"
                id="admin-tabpanel-details"
                aria-labelledby="admin-tab-details"
                className="admin-workspace-panel"
                data-tab-panel="details"
                hidden={workspaceTab !== 'details'}
              >
                <section className="admin-card" data-part="details-main">
                <div className="admin-field-grid">
                <label className="admin-field admin-field--short">
                  <span>שם האתר</span>
                  <input
                    value={form.display_name}
                    onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                    required
                    autoFocus
                  />
                </label>
                <UrlFieldWithCopy
                  label="כתובת הבית (Home URL)"
                  value={form.primary_url}
                  onChange={(value) => setForm({ ...form, primary_url: value })}
                  required
                  placeholder="https://www.example.co.il"
                  openLabel="דף הבית"
                />
                <label className="admin-field">
                  <span>סוג כניסה</span>
                  <select
                    value={loginEntryType}
                    onChange={(e) =>
                      setLoginEntryType(e.target.value as ExplicitLoginEntryType)
                    }
                  >
                    <option value="primary_page">{ADMIN_PRIMARY_PAGE_LABEL}</option>
                    <option value="direct_url">{ADMIN_DIRECT_URL_LABEL}</option>
                  </select>
                </label>
                {loginEntryType === 'direct_url' ? (
                  <UrlFieldWithCopy
                    label="כתובת כניסה"
                    value={form.login_url ?? ''}
                    onChange={(value) => setForm({ ...form, login_url: value })}
                    required
                    placeholder="https://example.com/login"
                    openLabel="דף כניסה"
                    openUrl={dedicatedLoginUrlOrNull(loginEntryType, form.login_url)}
                  />
                ) : (
                  <p className="admin-field-hint">
                    כניסה מדף הבית תישמר ככתובת הבית.
                  </p>
                )}
                <label className="admin-field">
                  <span>קטגוריה</span>
                  <select
                    ref={categorySelectRef}
                    value={form.category_id ?? ''}
                    aria-required="true"
                    aria-invalid={categoryError}
                    aria-describedby={categoryError ? 'admin-category-error' : undefined}
                    data-field="category"
                    onChange={(e) => {
                      setForm({ ...form, category_id: e.target.value || null });
                      if (e.target.value) setCategoryError(false);
                    }}
                  >
                    <option value="" disabled>
                      {ADMIN_WORKSPACE_HE.categoryPlaceholder}
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.display_name}
                      </option>
                    ))}
                  </select>
                  {categoryError ? (
                    <span className="admin-field-error" id="admin-category-error" role="alert" data-error="category-required">
                      {ADMIN_WORKSPACE_HE.categoryRequired}
                    </span>
                  ) : null}
                </label>
                <label className="admin-field">
                  <span>סטטוס</span>
                  <select
                    value={form.service_status}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        service_status: e.target.value as GlobalRegistryInput['service_status'],
                      })
                    }
                  >
                    <option value="active">פעיל</option>
                    <option value="pending_review">ממתין לאישור</option>
                    <option value="deprecated">מיושן</option>
                    <option value="disabled">מושבת</option>
                  </select>
                </label>
                {isCreating ? (
                  <p className="admin-muted">
                    מזהה טכני ייווצר אוטומטית:{' '}
                    <strong>
                      {deriveRegistryServiceIdFromUrl(form.primary_url) || '— הזינו כתובת בית'}
                    </strong>
                  </p>
                ) : null}
                </div>
                </section>
                {!isUserOwnedRow && (
                  <section className="admin-card admin-credentials-card" data-part="credentials-card">
                    <h4 className="admin-card-title">שדות כניסה</h4>
                    <label className="admin-field">
                      <span>פרטי כניסה</span>
                      <select
                        value={credentialMode}
                        onChange={(event) =>
                          void handleCredentialModeChange(event.target.value as CredentialMode)
                        }
                      >
                        <option value="not_configured">{ADMIN_MODE_NOT_CONFIGURED_LABEL}</option>
                        <option value="credential_fields">{ADMIN_MODE_CREDENTIAL_FIELDS_LABEL}</option>
                        <option value="no_stored_credentials">{ADMIN_MODE_NO_STORED_LABEL}</option>
                      </select>
                    </label>
                    {credentialMode === 'no_stored_credentials' ? (
                      <p className="admin-field-hint">{ADMIN_NO_STORED_HINT}</p>
                    ) : null}
                    {credentialMode === 'not_configured' ? (
                      <p className="admin-field-hint">{ADMIN_SCHEMA_NOT_CONFIGURED}</p>
                    ) : null}
                    {credentialMode === 'credential_fields' ? (
                      <CredentialFieldsEditor
                        fields={credentialFields}
                        onChange={(next) => {
                          setCredentialFields(next);
                          setConfigurationTouched(true);
                        }}
                        protectedFieldIds={savedFieldIdsInUse}
                        confirmFieldChange={confirmFieldChange}
                      />
                    ) : null}
                  </section>
                )}
                {!isCreating && selectedId && !isUserOwnedRow && (
                  <section className="admin-card admin-danger-zone" data-part="danger-zone">
                  <h4 className="admin-card-title">
                    <IconWarning />
                    {WORKSPACE_LAYOUT_HE.dangerTitle}
                  </h4>
                  <p className="admin-section-desc">{WORKSPACE_LAYOUT_HE.dangerHint}</p>
                  <div className="admin-actions-row" data-part="details-actions">
                    {!isUserOwnedRow && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger"
                        onClick={() => void handleDisable(selectedId)}
                      >
                        השבת
                      </button>
                    )}
                    {!isUserOwnedRow && selectedRow?.id === selectedId && (
                      <button
                        type="button"
                        className="admin-btn admin-btn-danger"
                        data-action="delete-service"
                        onClick={() =>
                          setDeleteTarget({ id: selectedRow.id, displayName: selectedRow.display_name })
                        }
                      >
                        {DELETE_SERVICE_COPY_HE.button}
                      </button>
                    )}
                  </div>
                  </section>
                )}
              </div>

              <div
                role="tabpanel"
                id="admin-tabpanel-login"
                aria-labelledby="admin-tab-login"
                className="admin-workspace-panel"
                data-tab-panel="login"
                hidden={workspaceTab !== 'login'}
              >
                {isUserOwnedRow ? (
                  <p className="admin-field-hint" role="status" data-hint="user-owned-login">
                    {WORKSPACE_TAB_HE.userOwnedLogin}
                  </p>
                ) : null}
                {!isUserOwnedRow && !managedGridsMounted ? (
                  <p className="admin-callout" role="status" data-hint="login-needs-fields">
                    {WORKSPACE_TAB_HE.loginNeedsFields}
                  </p>
                ) : null}
                {!isUserOwnedRow && (
                  <>
                    {credentialMode === 'credential_fields' &&
                    selectedRow?.owner_user_id === null &&
                    !isCreating ? (
                      <>
                        <LoginPatternGrid
                          row={selectedRow}
                          pattern={selectedAuthoringPattern ?? 'STANDARD'}
                          onPatternChange={onAuthoringPatternSelected}
                          disabled={patternSelectorLocked}
                          chooserOpen={patternChooserOpen}
                          onRequestChange={() => void requestPatternChange()}
                          onCloseChooser={() => setPatternChooserRowId(null)}
                        />
                        <SpecialLoginDraftEditor
                          key={`special-${selectedRow.id}`}
                          row={selectedRow}
                          onSaved={reload}
                          selectedPattern={selectedAuthoringPattern}
                          onSelectorLockChange={setSpecialSelectorLock}
                          onDraftDirtyChange={setSpecialDraftDirty}
                        />
                        <AutofillProfileEditor
                          key={selectedRow.id}
                          row={selectedRow}
                          onSaved={reload}
                          specialPatternSelected={specialPatternSelected}
                          onSharedStateChange={setManagedGridState}
                          fillTestRunning={fillTestRunning}
                        />
                      </>
                    ) : null}
                  </>
                )}
              </div>

              <div
                role="tabpanel"
                id="admin-tabpanel-test"
                aria-labelledby="admin-tab-test"
                className="admin-workspace-panel"
                data-tab-panel="test"
                hidden={workspaceTab !== 'test'}
              >
                {isUserOwnedRow ? (
                  <p className="admin-field-hint" role="status" data-hint="user-owned-test">
                    {WORKSPACE_TAB_HE.userOwnedTest}
                  </p>
                ) : null}
                {!isUserOwnedRow && !managedGridsMounted ? (
                  <p className="admin-callout" role="status" data-hint="test-needs-fields">
                    {WORKSPACE_TAB_HE.testNeedsFields}
                  </p>
                ) : null}
                {managedGridsMounted && selectedRow ? (
                  <>
                    <AdminFillTestGrid
                      key={`fill-test-${selectedRow.id}`}
                      row={selectedRow}
                      onSaved={reload}
                      managedGrid={managedGridState}
                      specialDraftDirty={specialDraftDirty}
                      selectedPattern={selectedAuthoringPattern}
                      onTestingChange={setFillTestRunning}
                      statusLine={<MappingStatusLine status={testTabMappingStatus} />}
                      onGoToLoginTab={() => setWorkspaceTab('login')}
                      active={workspaceTab === 'test'}
                    />
                  </>
                ) : null}
              </div>

              <div
                role="tabpanel"
                id="admin-tabpanel-notes"
                aria-labelledby="admin-tab-notes"
                className="admin-workspace-panel"
                data-tab-panel="notes"
                hidden={workspaceTab !== 'notes'}
              >
                {!isCreating && selectedRow ? (
                  <AdminNotesPanel
                    key={`notes-${selectedRow.id}`}
                    serviceId={selectedRow.id}
                    onDirtyChange={setNotesDirty}
                    onSaved={onNoteSaved}
                  />
                ) : null}
              </div>

              {/* Only «פרטי אתר» edits the service form; hidden (not unmounted) elsewhere so the
                  form's implicit submission and onInvalid behave as before. */}
              <div className="admin-actions-row admin-save-bar" data-part="save-bar" hidden={workspaceTab !== 'details'}>
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                    disabled={saving}
                >
                  שמור
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-secondary"
                  onClick={cancelEdit}
                >
                  ביטול
                </button>
              </div>
            </form>
          )}

          {!isCreating && selectedRow && (
            <aside
              className="admin-workspace-aside"
              data-part="details-aside"
              aria-labelledby="admin-tab-details"
              hidden={workspaceTab !== 'details'}
            >
              {selectedRow.owner_user_id === null && (
                <>
                  <IconAssetEditor
                    row={selectedRow}
                    onUploadFile={async (file) => {
                      await uploadAdminIconFile(selectedRow.id, file);
                      setSuccess('האייקון הועלה ונשמר כנכס מנוהל פעיל.');
                      await reload();
                    }}
                    onSaveSecondaryMetadata={async (patch) => {
                      await updateIconMetadata(selectedRow.id, patch);
                      setSuccess('מטא-דאטה משנית לעיצוב אייקון עודכנה.');
                      await reload();
                    }}
                    onRefreshAsset={async (options) => {
                      const result = await adminRefreshServiceIcon(
                        selectedRow.id,
                        options,
                      );
                      setSuccess(result.message);
                      await reload();
                    }}
                  />
                </>
              )}
              <details
                className="admin-collapse admin-card admin-more-details"
                data-part="more-details"
                open={showMoreDetails}
                onToggle={(event) => setShowMoreDetails(event.currentTarget.open)}
              >
                <summary id="admin-more-details-title">פרטים נוספים</summary>
                <div className="admin-collapse-body">
                  <dl className="admin-status-grid">
                    <div>
                      <dt>מזהה גלובלי</dt>
                      <dd>{selectedRow.id}</dd>
                    </div>
                    <div>
                      <dt>מקור (source_type)</dt>
                      <dd>
                        <select
                          value={form.source_type}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              source_type: e.target.value as GlobalRegistryInput['source_type'],
                            })
                          }
                        >
                          <option value="admin">admin</option>
                          <option value="approved_global">approved_global</option>
                          <option value="built_in">built_in</option>
                        </select>
                      </dd>
                    </div>
                    <div>
                      <dt>Adapter</dt>
                      <dd>
                        <input
                          value={form.adapter_id ?? ''}
                          onChange={(e) => setForm({ ...form, adapter_id: e.target.value })}
                          placeholder="ריק = generic"
                        />
                      </dd>
                    </div>
                    <div>
                      <dt>login_url_status</dt>
                      <dd>{selectedRow.login_url_status ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>login_fields</dt>
                      <dd>
                        <pre className="admin-pre">{JSON.stringify(selectedRow.login_fields ?? null, null, 2)}</pre>
                      </dd>
                    </div>
                    <div>
                      <dt>metadata_version</dt>
                      <dd>{selectedRow.metadata_version ?? '—'}</dd>
                    </div>
                    <div>
                      <dt>updated_at</dt>
                      <dd>{selectedRow.updated_at ?? '—'}</dd>
                    </div>
                  </dl>

                  <details className="admin-details" style={{ marginTop: '0.75rem' }}>
                    <summary>מטא-דאטה (JSON)</summary>
                    <pre className="admin-pre">{JSON.stringify(selectedRow.metadata ?? {}, null, 2)}</pre>
                  </details>

                  {selectedRow.owner_user_id === null && (
                    <>
                      <IntegrationStatusPanel row={selectedRow} />
                      <LoginIntelligencePanel
                        row={selectedRow}
                        onRefresh={async (options) => {
                          const result = await adminRefreshLoginIntelligence(
                            selectedRow.id,
                            options,
                          );
                          setSuccess(result.message);
                          await reload();
                          return result.message;
                        }}
                        onOverride={async (patch) => {
                          await adminOverrideLoginIntelligence(selectedRow.id, patch);
                          setSuccess('דריסת Login Intelligence נשמרה.');
                          await reload();
                        }}
                      />
                    </>
                  )}
                </div>
              </details>
            </aside>
          )}
          </div>
          </div>
        </div>
      ) : null}

      {deleteTarget && (
        <DeleteServiceDialog
          key={deleteTarget.id}
          service={deleteTarget}
          loadImpact={fetchServiceDeleteImpact}
          deleteService={adminDeleteService}
          onDeleted={() => {
            cancelEdit();
            void reload();
          }}
          onClose={() => setDeleteTarget(null)}
        />
      )}
      {confirmDialog}

    </section>
  );
}
