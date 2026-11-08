import { EmptyState } from '@/components/layout/empty-state'
import { ScreenHeader } from '@/components/layout/screen-header'
import { useI18n } from '@/i18n/use-i18n'

// Miqtë (V2-E1-05): bosh deri te Etapa 4 (ftesat, sfidat, progresi i ndarë). Ekrani thotë çfarë vjen,
// pa butona që nuk punojnë ende.
export function FriendsPage() {
  const { t } = useI18n()
  return (
    <div className="flex min-h-[calc(100dvh-var(--spacing-tab-bar)-var(--safe-top)-var(--safe-bottom)-44px)] flex-col gap-[18px]">
      <ScreenHeader title={t('tab.friends')} />
      <EmptyState
        title={t('friends.emptyTitle')}
        intro={t('friends.emptyIntro')}
        items={[
          { title: t('friends.invites'), text: t('friends.invitesText') },
          { title: t('friends.challenges'), text: t('friends.challengesText') },
          { title: t('friends.shared'), text: t('friends.sharedText') },
        ]}
      />
    </div>
  )
}
