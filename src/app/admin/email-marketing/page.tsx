import { requireAdmin } from "@/lib/auth";
import { ADMIN_PERMISSIONS } from "@/lib/staffPermissions";
import {
  ALL_CAMPAIGN_TEMPLATE_KEYS,
  CAMPAIGN_TEMPLATES,
  type CampaignTemplateKey,
} from "@/lib/campaignTemplates";
import {
  ALL_AUDIENCE_SEGMENT_KEYS,
  AUDIENCE_SEGMENTS,
  type AudienceSegmentKey,
} from "@/lib/audienceSegments";
import { CampaignBuilder } from "./CampaignBuilder";

export default async function AdminEmailMarketingPage() {
  await requireAdmin(ADMIN_PERMISSIONS.MANAGE_EMAIL);

  // Build serializable views of the registries the client form needs.
  const templates = ALL_CAMPAIGN_TEMPLATE_KEYS.map((key) => ({
    key,
    title: CAMPAIGN_TEMPLATES[key].title,
    audience: CAMPAIGN_TEMPLATES[key].audience,
    segment: CAMPAIGN_TEMPLATES[key].segment as CampaignTemplateKey extends never
      ? AudienceSegmentKey
      : AudienceSegmentKey,
    description: CAMPAIGN_TEMPLATES[key].description,
    subject: CAMPAIGN_TEMPLATES[key].subject,
    body: CAMPAIGN_TEMPLATES[key].body,
  }));
  const segments = ALL_AUDIENCE_SEGMENT_KEYS.map((key) => ({
    key,
    label: AUDIENCE_SEGMENTS[key].label,
    description: AUDIENCE_SEGMENTS[key].description,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Email marketing</h1>
        <p className="text-sm text-ink-600">
          Send pre-baked engagement campaigns to sellers, buyers, and
          designers. Pick a template, tweak the copy if you want, preview
          the recipient count, then hit send. Campaigns use the same rate-
          limited pipeline as broadcasts and log into the existing
          EmailBroadcast audit table.
        </p>
      </div>
      <CampaignBuilder templates={templates} segments={segments} />
    </div>
  );
}
