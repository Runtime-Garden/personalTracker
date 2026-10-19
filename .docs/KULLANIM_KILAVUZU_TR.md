# OpenCode kullanım kılavuzu — Personal Tracker

Bu ZIP **uygulama kodu değil**, OpenCode için hazırlanmış ürün/teknik spesifikasyon, tasarım varlıkları, görev promptları ve geliştirme yol haritasıdır. Kaynak PHP projesi incelendi; gizli anahtar içerebilecek orijinal ZIP paketi bu arşive yeniden eklenmedi.

## Nasıl başlayacaksın?

1. ZIP'i örneğin `D:\Development\personal-tracker-next` içine aç. Klasörün kökünde `AGENTS.md` ve `README.md` bulunmalı.
2. OpenCode'u **bu klasörde** başlat ve `prompts/00-MASTER-OPENCODE-PROMPT.md` içeriğini gönder. `AGENTS.md` OpenCode'un proje kurallarını yüklemesi içindir.
3. İlk yanıt için mimari + repo planı + Phase 0/1 incelemesini iste. **Tüm uygulamayı tek promptta kodlatma.** Mimariyi onayladıktan sonra `prompts/01-FOUNDATION.md` ile başla.
4. Her aşamanın sonunda gerçek test çıktısı ve değişen dosyaların listesini iste. Kabul kapıları `docs/09-PHASED-ROADMAP.md` ve `docs/quality/01-ACCEPTANCE-CRITERIA.md` içinde.
5. Yeni kod hazır olduğunda eski verileri taşımak istersen **ayrı** snapshot ve kuru çalıştırma kullan. Migration aşamasına kadar `personalTracker.zip` ve eski `.env` dosyasını repo içerisine koyma.
6. Sunucuya deploy etmeden önce staging, backup/restore ve yetki sınırlarının testini tamamla. OpenCode'a SSH/VPS/Cloudflare/Dockge değişikliği için ayrıca açık onay ver.

## Önemli ayrımlar

- **Personal** alanında içerik kişiye özel; **Team** alanında içerik davet edilen üyelere rol bazlı görünür.
- **System Admin** aynı arayüzde ek bir Settings → System bölümü görür. Sırf sistem yöneticisi olduğu için özel görevleri otomatik okuyamaz.
- AI sağlayıcı desteği modülerdir. Gerçek uyumluluk kullanılan modelin tool calling/JSON/stream desteğine göre doğrulanır; desteklenmeyen modele sahte destek verilmez.
- Runtime Garden marka dosyaları `references/brand/assets/` altındadır. Eski ekran görüntüsü `references/legacy/dashboard.png` altında sadece işlevsel referanstır.
- Arşivde çalışan sistem, Docker Compose dosyası, üretim anahtarları ya da deploy edilmiş bir uygulama yoktur: hepsini OpenCode aşamalar halinde üretecek.

## İlk aşama için en yararlı belgeler

`README.md`, `AGENTS.md`, `docs/00-START-HERE.md`, `docs/01-PRODUCT-REQUIREMENTS.md`, `docs/04-PERMISSIONS-AND-WORKSPACES.md`, `docs/architecture/01-SYSTEM-ARCHITECTURE.md`, `docs/ai/02-AI-TOOLS-AND-APPROVALS.md`, `docs/design/01-DESIGN-SYSTEM.md`, `docs/09-PHASED-ROADMAP.md`.
