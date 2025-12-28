'use client'

import { useCallback, useEffect, useState } from 'react'

const LANGUAGE_KEY = 'myte-lang'

export type Language = 'en' | 'fr'

const translations: Record<Language, Record<string, string>> = {
  en: {
    'nav.dashboard': 'Dashboard',
    'nav.projects': 'Projects',
    'nav.org_locations': 'Org locations',
    'nav.people': 'People',
    'nav.settings': 'Settings',
    'nav.users': 'Users',
    'nav.invites': 'Invites',
    'nav.notifications': 'Notifications',
    'nav.graph': 'Graph',
    'nav.platform_admin': 'Platform Ops',
    'nav.sign_out': 'Sign out',
    'nav.sign_in': 'Sign in',
    'nav.menu': 'Menu',
    'nav.close': 'Close',
    'theme.light': 'Light',
    'theme.dark': 'Dark',
    'nav.workspace': 'Workspace',
    'nav.org_id': 'Org {id}',
    'costcodes.eyebrow': 'Org Settings',
    'costcodes.title': 'Cost Codes',
    'costcodes.subtitle': 'Org-level cost codes used for timesheets and estimating.',
    'costcodes.actions.refresh': 'Refresh',
    'costcodes.actions.new': 'New cost code',
    'costcodes.actions.import': 'Import Excel',
    'costcodes.actions.bulk_upsert': 'Bulk upsert',
    'costcodes.actions.seed': 'Apply Steel Field Pack',
    'costcodes.actions.seeding': 'Applying...',
    'costcodes.actions.loading': 'Loading...',
    'costcodes.stats.total': 'Total codes',
    'costcodes.stats.active': 'Active',
    'costcodes.stats.inactive': 'Inactive',
    'costcodes.stats.used': 'Used',
    'costcodes.filters.title': 'Filters',
    'costcodes.filters.search': 'Search',
    'costcodes.filters.search_placeholder': 'Code, category, description',
    'costcodes.filters.status': 'Status',
    'costcodes.filters.category': 'Category',
    'costcodes.filters.updated_since': 'Updated since',
    'costcodes.filters.clear': 'Clear filter',
    'costcodes.filters.all': 'All',
    'costcodes.filters.active': 'Active',
    'costcodes.filters.inactive': 'Inactive',
    'costcodes.directory.title': 'Directory',
    'costcodes.directory.count': '{count} codes',
    'costcodes.empty': 'No cost codes yet. Use "New cost code" or import from Excel.',
    'costcodes.table.code': 'Code',
    'costcodes.table.description': 'Description',
    'costcodes.table.category': 'Category',
    'costcodes.table.status': 'Status',
    'costcodes.table.used': 'Used',
    'costcodes.table.updated': 'Updated',
    'costcodes.table.actions': 'Actions',
    'costcodes.status.active': 'Active',
    'costcodes.status.inactive': 'Inactive',
    'costcodes.used': 'Used',
    'costcodes.not_used': 'Not used',
    'costcodes.modal.create_title': 'New cost code',
    'costcodes.modal.edit_title': 'Edit cost code',
    'costcodes.modal.subtitle': 'Cost codes are scoped to your organization.',
    'costcodes.field.category': 'Category',
    'costcodes.field.code': 'Code',
    'costcodes.field.description': 'Description',
    'costcodes.modal.cancel': 'Cancel',
    'costcodes.modal.save': 'Save changes',
    'costcodes.modal.create': 'Create cost code',
    'costcodes.modal.saving': 'Saving...',
    'costcodes.placeholder.category': 'Logistics',
    'costcodes.placeholder.code': '1010',
    'costcodes.placeholder.description': 'Mobilize crew and equipment to site',
    'costcodes.import.title': 'Import cost codes',
    'costcodes.import.subtitle':
      'This replaces all cost codes for your organization. Imports are blocked if any code is already used.',
    'costcodes.import.step.upload': 'Upload',
    'costcodes.import.step.processing': 'Processing',
    'costcodes.import.step.preview': 'Review',
    'costcodes.import.step.summary': 'Summary',
    'costcodes.import.upload_label': 'Upload Excel file',
    'costcodes.import.upload_hint': 'XLSX or XLS format. The import runs in the background.',
    'costcodes.import.template': 'Download template',
    'costcodes.import.template_hint': 'Columns: Category, Code, Description.',
    'costcodes.import.template_failed': 'Failed to download template.',
    'costcodes.import.start': 'Start import',
    'costcodes.import.starting': 'Uploading...',
    'costcodes.import.status_label': 'Import status',
    'costcodes.import.processing_note': 'You can close this. We will keep working and you can return to review.',
    'costcodes.import.preview_title': 'Preview',
    'costcodes.import.preview_empty': 'Upload a file to generate a preview.',
    'costcodes.import.preview_count': '{count} cost codes detected.',
    'costcodes.import.preview_hint': 'Showing first 40 rows. The full set will be imported.',
    'costcodes.import.review_title': 'Review & edit',
    'costcodes.import.review_hint': 'Fix missing fields and duplicates before committing.',
    'costcodes.import.add_row': 'Add row',
    'costcodes.import.remove_row': 'Remove',
    'costcodes.import.commit': 'Commit import',
    'costcodes.import.committing': 'Committing...',
    'costcodes.import.close': 'Close',
    'costcodes.import.done': 'Close & refresh',
    'costcodes.import.help': 'Uploads are analyzed in the background. Review and edit before committing.',
    'costcodes.import.seed_hint': 'Need a starter set? Apply the Steel Field Pack, then fine-tune your list.',
    'costcodes.import.back': 'Back to settings',
    'costcodes.import.resume_notice': 'Resuming your last import.',
    'costcodes.import.empty_preview': 'No rows available yet.',
    'costcodes.import.validation.title': 'Issues to resolve',
    'costcodes.import.validation.summary': '{count} issue(s) blocking commit.',
    'costcodes.import.validation.code_missing': 'Row {row}: code is required.',
    'costcodes.import.validation.description_missing': 'Row {row}: description is required.',
    'costcodes.import.validation.duplicate': 'Row {row}: duplicate code "{code}".',
    'costcodes.import.validation.more': '+{count} more issue(s).',
    'costcodes.import.warning.title': 'Optional checks',
    'costcodes.import.warning.category_default': 'Empty category will default to General.',
    'costcodes.import.summary.title': 'Import summary',
    'costcodes.import.summary.inserted': 'Inserted',
    'costcodes.import.summary.updated': 'Updated',
    'costcodes.import.summary.muted': 'Deactivated',
    'costcodes.import.summary.empty': 'No summary available for this import.',
    'costcodes.import.file_error_type': 'Please upload an Excel file (.xlsx or .xls).',
    'costcodes.import.file_error_size': 'File is too large. Max size is {size} MB.',
    'costcodes.bulk.title': 'Bulk upsert cost codes',
    'costcodes.bulk.subtitle': 'Paste rows to update or add cost codes without replacing the full list.',
    'costcodes.bulk.input_label': 'Paste rows',
    'costcodes.bulk.placeholder': 'Category, Code, Description',
    'costcodes.bulk.preview_title': 'Preview',
    'costcodes.bulk.preview_empty': 'Paste rows to see a preview.',
    'costcodes.bulk.preview_default': 'Général',
    'costcodes.bulk.metrics.total': 'Rows',
    'costcodes.bulk.metrics.valid': 'Valid',
    'costcodes.bulk.validation.title': 'Issues to resolve',
    'costcodes.bulk.validation.summary': '{count} issue(s) blocking upsert.',
    'costcodes.bulk.validation.missing_fields': 'Line {line}: code and description are required.',
    'costcodes.bulk.validation.duplicate': 'Line {line}: duplicate code "{code}".',
    'costcodes.bulk.validation.more': '+{count} more issue(s).',
    'costcodes.bulk.validation.blocked': 'Resolve the issues before applying the upsert.',
    'costcodes.bulk.apply': 'Apply upsert',
    'costcodes.bulk.applying': 'Applying...',
    'costcodes.bulk.close': 'Close',
    'costcodes.bulk.summary.title': 'Upsert summary',
    'costcodes.bulk.summary.upserted': 'Upserted',
    'costcodes.bulk.summary.modified': 'Modified',
    'costcodes.bulk.messages.applied': 'Bulk upsert applied: {upserted} upserted, {modified} updated.',
    'costcodes.bulk.errors.failed': 'Failed to apply bulk upsert.',
    'costcodes.import.status.queued': 'Queued',
    'costcodes.import.status.processing': 'Processing',
    'costcodes.import.status.preview': 'Preview ready',
    'costcodes.import.status.failed': 'Failed',
    'costcodes.import.status.done': 'Done',
    'costcodes.import.failed_message': 'Import failed.',
    'costcodes.actions.edit': 'Edit',
    'costcodes.actions.deactivate': 'Deactivate',
    'costcodes.actions.activate': 'Activate',
    'costcodes.actions.delete': 'Delete',
    'costcodes.confirm.delete': 'Delete cost code {code}? If used, it will be deactivated.',
    'costcodes.confirm.seed': 'Apply the Steel Field Pack? This replaces all cost codes for your organization.',
    'costcodes.messages.created': 'Cost code created.',
    'costcodes.messages.updated': 'Cost code updated.',
    'costcodes.messages.deleted': 'Cost code removed.',
    'costcodes.messages.deactivated': 'Cost code deactivated.',
    'costcodes.messages.activated': 'Cost code activated.',
    'costcodes.messages.import_committed': 'Import committed. Cost codes replaced for this org.',
    'costcodes.messages.seeded': 'Seed pack applied.',
    'costcodes.errors.signin': 'You need to sign in to manage cost codes.',
    'costcodes.errors.no_org': 'Your session is missing an organization scope.',
    'costcodes.errors.admin_required': 'Org admin access required to manage cost codes.',
    'costcodes.errors.load_failed': 'Unable to load cost codes.',
    'costcodes.errors.create_failed': 'Failed to create cost code.',
    'costcodes.errors.update_failed': 'Failed to update cost code.',
    'costcodes.errors.status_failed': 'Failed to update status.',
    'costcodes.errors.delete_failed': 'Failed to delete cost code.',
    'costcodes.errors.import_start_failed': 'Failed to start import.',
    'costcodes.errors.import_commit_failed': 'Failed to commit import.',
    'costcodes.errors.seed_failed': 'Failed to apply seed pack.',
    'costcodes.notice.legal_hold':
      'Legal hold is enabled for this organization. Cost code updates and imports are blocked.',
    'costcodes.notice.archived': 'This organization is archived. Cost code updates are blocked.',
    'costcodes.import.replacement_note': 'Imports replace the full list for your organization.',
  },
  fr: {
    'nav.dashboard': 'Tableau de bord',
    'nav.projects': 'Projets',
    'nav.org_locations': "Sites d'organisation",
    'nav.people': 'Personnes',
    'nav.settings': 'Paramètres',
    'nav.users': 'Utilisateurs',
    'nav.invites': 'Invitations',
    'nav.notifications': 'Notifications',
    'nav.graph': 'Graphe',
    'nav.platform_admin': 'Ops plateforme',
    'nav.sign_out': 'Se déconnecter',
    'nav.sign_in': 'Se connecter',
    'nav.menu': 'Menu',
    'nav.close': 'Fermer',
    'theme.light': 'Clair',
    'theme.dark': 'Sombre',
    'nav.workspace': 'Espace',
    'nav.org_id': 'Org {id}',
    'costcodes.eyebrow': "Paramètres d'organisation",
    'costcodes.title': 'Codes de coûts',
    'costcodes.subtitle': "Codes de coûts de l'organisation utilisés pour les feuilles de temps et les estimations.",
    'costcodes.actions.refresh': 'Actualiser',
    'costcodes.actions.new': 'Nouveau code',
    'costcodes.actions.import': 'Importer Excel',
    'costcodes.actions.bulk_upsert': 'Mise à jour en masse',
    'costcodes.actions.seed': 'Appliquer le pack acier',
    'costcodes.actions.seeding': 'Application...',
    'costcodes.actions.loading': 'Chargement...',
    'costcodes.stats.total': 'Total',
    'costcodes.stats.active': 'Actifs',
    'costcodes.stats.inactive': 'Inactifs',
    'costcodes.stats.used': 'Utilisés',
    'costcodes.filters.title': 'Filtres',
    'costcodes.filters.search': 'Recherche',
    'costcodes.filters.search_placeholder': 'Code, catégorie, description',
    'costcodes.filters.status': 'Statut',
    'costcodes.filters.category': 'Catégorie',
    'costcodes.filters.updated_since': 'Mis à jour depuis',
    'costcodes.filters.clear': 'Effacer le filtre',
    'costcodes.filters.all': 'Tous',
    'costcodes.filters.active': 'Actifs',
    'costcodes.filters.inactive': 'Inactifs',
    'costcodes.directory.title': 'Répertoire',
    'costcodes.directory.count': '{count} codes',
    'costcodes.empty': 'Aucun code de coût. Utilisez "Nouveau code" ou importez depuis Excel.',
    'costcodes.table.code': 'Code',
    'costcodes.table.description': 'Description',
    'costcodes.table.category': 'Catégorie',
    'costcodes.table.status': 'Statut',
    'costcodes.table.used': 'Utilisé',
    'costcodes.table.updated': 'Mis à jour',
    'costcodes.table.actions': 'Actions',
    'costcodes.status.active': 'Actif',
    'costcodes.status.inactive': 'Inactif',
    'costcodes.used': 'Utilisé',
    'costcodes.not_used': 'Non utilisé',
    'costcodes.modal.create_title': 'Nouveau code de coût',
    'costcodes.modal.edit_title': 'Modifier le code de coût',
    'costcodes.modal.subtitle': "Les codes de coûts sont limités à votre organisation.",
    'costcodes.field.category': 'Catégorie',
    'costcodes.field.code': 'Code',
    'costcodes.field.description': 'Description',
    'costcodes.modal.cancel': 'Annuler',
    'costcodes.modal.save': 'Enregistrer',
    'costcodes.modal.create': 'Créer le code',
    'costcodes.modal.saving': 'Enregistrement...',
    'costcodes.placeholder.category': 'Logistique',
    'costcodes.placeholder.code': '1010',
    'costcodes.placeholder.description': "Mobiliser l'équipe et l'équipement sur site",
    'costcodes.import.title': 'Importer des codes de coûts',
    'costcodes.import.subtitle':
      "Cela remplace tous les codes de coûts de votre organisation. Import bloqué si un code est déjà utilisé.",
    'costcodes.import.step.upload': 'Téléversement',
    'costcodes.import.step.processing': 'Traitement',
    'costcodes.import.step.preview': 'Revue',
    'costcodes.import.step.summary': 'Résumé',
    'costcodes.import.upload_label': 'Téléverser un fichier Excel',
    'costcodes.import.upload_hint': "Format XLSX ou XLS. L'import se fait en arrière-plan.",
    'costcodes.import.template': 'Télécharger le modèle',
    'costcodes.import.template_hint': 'Colonnes : Catégorie, Code, Description.',
    'costcodes.import.template_failed': 'Échec du téléchargement du modèle.',
    'costcodes.import.start': "Démarrer l'import",
    'costcodes.import.starting': 'Téléversement...',
    'costcodes.import.status_label': "Statut de l'import",
    'costcodes.import.processing_note': 'Vous pouvez fermer cette fenêtre. Vous pourrez revenir pour valider.',
    'costcodes.import.preview_title': 'Aperçu',
    'costcodes.import.preview_empty': 'Téléversez un fichier pour générer un aperçu.',
    'costcodes.import.preview_count': '{count} codes détectés.',
    'costcodes.import.preview_hint': "Affichage des 40 premières lignes. L'ensemble sera importé.",
    'costcodes.import.review_title': 'Revoir et modifier',
    'costcodes.import.review_hint': 'Corrigez les champs manquants et les doublons avant de valider.',
    'costcodes.import.add_row': 'Ajouter une ligne',
    'costcodes.import.remove_row': 'Supprimer',
    'costcodes.import.commit': "Valider l'import",
    'costcodes.import.committing': 'Validation...',
    'costcodes.import.close': 'Fermer',
    'costcodes.import.done': 'Fermer et actualiser',
    'costcodes.import.help': "Les uploads sont analysés en arrière-plan. Revoyez avant de valider.",
    'costcodes.import.seed_hint': "Besoin d'un pack de départ? Appliquez le pack acier puis ajustez.",
    'costcodes.import.back': 'Retour aux paramètres',
    'costcodes.import.resume_notice': 'Reprise du dernier import.',
    'costcodes.import.empty_preview': 'Aucune ligne disponible pour le moment.',
    'costcodes.import.validation.title': 'Problèmes à résoudre',
    'costcodes.import.validation.summary': '{count} problème(s) bloquent la validation.',
    'costcodes.import.validation.code_missing': 'Ligne {row} : code requis.',
    'costcodes.import.validation.description_missing': 'Ligne {row} : description requise.',
    'costcodes.import.validation.duplicate': 'Ligne {row} : code en double "{code}".',
    'costcodes.import.validation.more': '+{count} problème(s) supplémentaires.',
    'costcodes.import.warning.title': 'Vérifications facultatives',
    'costcodes.import.warning.category_default': 'Catégorie vide : "General" sera appliquée.',
    'costcodes.import.summary.title': "Résumé de l'import",
    'costcodes.import.summary.inserted': 'Insérés',
    'costcodes.import.summary.updated': 'Mis à jour',
    'costcodes.import.summary.muted': 'Désactivés',
    'costcodes.import.summary.empty': "Aucun résumé disponible pour cet import.",
    'costcodes.import.file_error_type': 'Veuillez téléverser un fichier Excel (.xlsx ou .xls).',
    'costcodes.import.file_error_size': 'Fichier trop volumineux. Taille max {size} MB.',
    'costcodes.bulk.title': 'Mise à jour en masse des codes de coûts',
    'costcodes.bulk.subtitle': "Collez des lignes pour mettre à jour ou ajouter sans remplacer toute la liste.",
    'costcodes.bulk.input_label': 'Coller des lignes',
    'costcodes.bulk.placeholder': 'Catégorie, Code, Description',
    'costcodes.bulk.preview_title': 'Aperçu',
    'costcodes.bulk.preview_empty': 'Collez des lignes pour voir un aperçu.',
    'costcodes.bulk.preview_default': 'General',
    'costcodes.bulk.metrics.total': 'Lignes',
    'costcodes.bulk.metrics.valid': 'Valides',
    'costcodes.bulk.validation.title': 'Problèmes à résoudre',
    'costcodes.bulk.validation.summary': '{count} problème(s) bloquent la mise à jour.',
    'costcodes.bulk.validation.missing_fields': 'Ligne {line} : code et description requis.',
    'costcodes.bulk.validation.duplicate': 'Ligne {line} : code en double "{code}".',
    'costcodes.bulk.validation.more': '+{count} problème(s) supplémentaires.',
    'costcodes.bulk.validation.blocked': 'Corrigez les problèmes avant de valider.',
    'costcodes.bulk.apply': 'Valider',
    'costcodes.bulk.applying': 'Application...',
    'costcodes.bulk.close': 'Fermer',
    'costcodes.bulk.summary.title': 'Résumé',
    'costcodes.bulk.summary.upserted': 'Insérés/Mis à jour',
    'costcodes.bulk.summary.modified': 'Modifiés',
    'costcodes.bulk.messages.applied': 'Mise à jour appliquée : {upserted} insérés, {modified} modifiés.',
    'costcodes.bulk.errors.failed': "Échec de la mise à jour en masse.",
    'costcodes.import.status.queued': 'En attente',
    'costcodes.import.status.processing': 'Traitement',
    'costcodes.import.status.preview': 'Aperçu prêt',
    'costcodes.import.status.failed': 'Échec',
    'costcodes.import.status.done': 'Terminé',
    'costcodes.import.failed_message': "Échec de l'import.",
    'costcodes.actions.edit': 'Modifier',
    'costcodes.actions.deactivate': 'Désactiver',
    'costcodes.actions.activate': 'Activer',
    'costcodes.actions.delete': 'Supprimer',
    'costcodes.confirm.delete': "Supprimer le code {code}? S'il est utilisé, il sera désactivé.",
    'costcodes.confirm.seed': 'Appliquer le pack acier ? Cela remplace tous les codes de votre organisation.',
    'costcodes.messages.created': 'Code de coût créé.',
    'costcodes.messages.updated': 'Code de coût mis à jour.',
    'costcodes.messages.deleted': 'Code de coût supprimé.',
    'costcodes.messages.deactivated': 'Code de coût désactivé.',
    'costcodes.messages.activated': 'Code de coût activé.',
    'costcodes.messages.import_committed':
      "Import validé. Les codes ont été remplacés pour cette organisation.",
    'costcodes.messages.seeded': 'Pack appliqué.',
    'costcodes.errors.signin': 'Vous devez vous connecter pour gérer les codes de coûts.',
    'costcodes.errors.no_org': "Votre session n'a pas de contexte d'organisation.",
    'costcodes.errors.admin_required': "Accès administrateur requis pour gérer les codes de coûts.",
    'costcodes.errors.load_failed': 'Impossible de charger les codes de coûts.',
    'costcodes.errors.create_failed': 'Échec de création du code de coût.',
    'costcodes.errors.update_failed': 'Échec de mise à jour du code de coût.',
    'costcodes.errors.status_failed': 'Échec de mise à jour du statut.',
    'costcodes.errors.delete_failed': 'Échec de suppression du code de coût.',
    'costcodes.errors.import_start_failed': "Échec du démarrage de l'import.",
    'costcodes.errors.import_commit_failed': "Échec de validation de l'import.",
    'costcodes.errors.seed_failed': "Échec de l'application du pack.",
    'costcodes.notice.legal_hold':
      "Gel légal activé pour cette organisation. Les mises à jour sont bloquées.",
    'costcodes.notice.archived': 'Cette organisation est archivée. Les mises à jour sont bloquées.',
    'costcodes.import.replacement_note': 'Les imports remplacent toute la liste pour votre organisation.',
  },
}

const normalizeLanguage = (value?: string | null): Language => {
  if (!value) return 'en'
  return value.toLowerCase().startsWith('fr') ? 'fr' : 'en'
}

const applyLanguage = (language: Language) => {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.lang = language
  document.documentElement.lang = language
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('myte-lang-change', { detail: language }))
  }
}

const interpolate = (template: string, vars?: Record<string, string | number>) => {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_, key) => String(vars[key] ?? `{${key}}`))
}

export const useLanguage = () => {
  const [language, setLanguageState] = useState<Language>('en')

  useEffect(() => {
    if (typeof window === 'undefined') return
    const stored = window.localStorage.getItem(LANGUAGE_KEY)
    const browser = normalizeLanguage(window.navigator.language || 'en')
    const initial = normalizeLanguage(stored || browser)
    setLanguageState(initial)
    applyLanguage(initial)
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleChange = (event: Event) => {
      const detail = (event as CustomEvent<string>).detail
      if (!detail) return
      const next = normalizeLanguage(detail)
      setLanguageState(next)
      applyLanguage(next)
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== LANGUAGE_KEY) return
      const next = normalizeLanguage(event.newValue || 'en')
      setLanguageState(next)
      applyLanguage(next)
    }
    window.addEventListener('myte-lang-change', handleChange as EventListener)
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('myte-lang-change', handleChange as EventListener)
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next)
    applyLanguage(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LANGUAGE_KEY, next)
    }
  }, [])

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const table = translations[language] || translations.en
      const fallback = translations.en
      const raw = table[key] || fallback[key] || key
      return interpolate(raw, vars)
    },
    [language]
  )

  return { language, setLanguage, t }
}
