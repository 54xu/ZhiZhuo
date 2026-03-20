<script setup lang="ts">
import { onMounted } from 'vue'

const isH5 = typeof document !== 'undefined'

const brandTags = ['门店数字化', '微信生态', '运营交付', '品牌增长']
const brandCapabilities = [
  {
    title: '系统先行',
    description: '从业务梳理到线上落地，让门店流程、会员沉淀与经营动作真正被系统承接。',
  },
  {
    title: '体验成面',
    description: '欢迎页专注品牌表达，不再承载登录和业务跳转，避免和小程序主体互相牵扯。',
  },
  {
    title: '运营协同',
    description: '收银、会员、报表与后续运营保持在业务系统里闭环，品牌页则单独承担对外展示。',
  },
  {
    title: '持续陪跑',
    description: '不是只把页面上线，而是和业务节奏一起推进，让每次迭代都指向真实结果。',
  },
]
const brandSignals = [
  { label: '品牌定位', value: '致卓网络 · 面向增长的数字化伙伴' },
  { label: '交付方式', value: '产品设计、系统搭建、运营协同一体推进' },
  { label: '核心目标', value: '致以卓越，成就非凡' },
]

onMounted(() => {
  if (!isH5) return
  document.title = '致卓网络'
})

function scrollToSection(targetId: string) {
  if (!isH5) return
  document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
</script>

<template>
  <view class="welcome-page">
    <view class="welcome-grid"></view>
    <view class="welcome-orb orb-blue"></view>
    <view class="welcome-orb orb-green"></view>
    <view class="welcome-orb orb-soft"></view>

    <view class="welcome-shell">
      <view class="hero-panel">
        <view class="hero-copy">
          <text class="hero-eyebrow">ZZ OPERATIONS · 致卓网络</text>
          <text class="hero-title">致以卓越 成就非凡</text>
          <text class="hero-subtitle">
            致卓网络以系统能力、品牌表达与运营交付为核心，帮助门店与品牌把每一次增长都做成可持续的日常能力。
          </text>

          <view class="hero-tags">
            <text v-for="tag in brandTags" :key="tag" class="hero-tag">{{ tag }}</text>
          </view>

          <view class="hero-actions">
            <view class="hero-btn hero-btn-primary" @tap="scrollToSection('capability-section')">品牌能力</view>
            <view class="hero-btn hero-btn-secondary" @tap="scrollToSection('brand-story')">品牌愿景</view>
          </view>
        </view>

        <view class="hero-brand">
          <view class="brand-card">
            <image class="brand-logo" src="/static/zz-operations-trademark.jpg" mode="widthFix" />
            <text class="brand-caption">以一致的品牌语言，连接产品、服务与长期信任。</text>
          </view>
        </view>
      </view>

      <view id="capability-section" class="capability-grid">
        <view v-for="item in brandCapabilities" :key="item.title" class="capability-card">
          <text class="capability-title">{{ item.title }}</text>
          <text class="capability-description">{{ item.description }}</text>
        </view>
      </view>

      <view id="brand-story" class="story-panel">
        <view class="story-heading">
          <text class="story-kicker">Brand Story</text>
          <text class="story-title">把系统、运营与品牌体验交到同一条增长链路里</text>
          <text class="story-description">
            从欢迎页的第一眼识别，到业务系统的真实落地，致卓网络希望每一次触达都更清晰、更有秩序，也更能服务结果。
          </text>
        </view>

        <view class="story-signal-grid">
          <view v-for="signal in brandSignals" :key="signal.label" class="story-signal-card">
            <text class="story-signal-label">{{ signal.label }}</text>
            <text class="story-signal-value">{{ signal.value }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<style scoped>
.welcome-page {
  --brand-blue: #16469f;
  --brand-green: #0ea74a;
  --brand-ink: #173162;
  --brand-line: rgba(22, 70, 159, 0.12);
  min-height: 100vh;
  position: relative;
  overflow: hidden;
  background:
    radial-gradient(circle at top left, rgba(14, 167, 74, 0.16), transparent 34%),
    linear-gradient(180deg, #f8fbff 0%, #eef4ff 45%, #f5fbf7 100%);
  color: var(--brand-ink);
  font-family: 'Avenir Next', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
}

.welcome-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(22, 70, 159, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(22, 70, 159, 0.05) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.9), transparent 88%);
}

.welcome-orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(12px);
}

.orb-blue {
  width: 320px;
  height: 320px;
  top: 72px;
  right: -120px;
  background: rgba(22, 70, 159, 0.18);
}

.orb-green {
  width: 240px;
  height: 240px;
  top: 400px;
  left: -90px;
  background: rgba(14, 167, 74, 0.16);
}

.orb-soft {
  width: 220px;
  height: 220px;
  bottom: 120px;
  right: 18%;
  background: rgba(32, 59, 114, 0.12);
}

.welcome-shell {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 1180px;
  margin: 0 auto;
  padding: 72px 24px 88px;
  box-sizing: border-box;
}

.hero-panel {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 36px;
  flex-wrap: wrap;
  margin-bottom: 42px;
}

.hero-copy,
.brand-card,
.capability-card,
.story-panel {
  opacity: 0;
  transform: translateY(24px);
  animation: fade-rise 0.8s ease forwards;
}

.brand-card {
  animation-delay: 0.14s;
}

.capability-card:nth-child(1) {
  animation-delay: 0.08s;
}

.capability-card:nth-child(2) {
  animation-delay: 0.16s;
}

.capability-card:nth-child(3) {
  animation-delay: 0.24s;
}

.capability-card:nth-child(4) {
  animation-delay: 0.32s;
}

.story-panel {
  animation-delay: 0.28s;
}

.hero-copy {
  flex: 1 1 520px;
  max-width: 620px;
}

.hero-eyebrow {
  display: inline-flex;
  align-items: center;
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(22, 70, 159, 0.14);
  box-shadow: 0 14px 34px rgba(23, 49, 98, 0.08);
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 1px;
  color: var(--brand-blue);
}

.hero-title {
  display: block;
  margin-top: 22px;
  font-size: 68px;
  line-height: 1.05;
  font-weight: 800;
  letter-spacing: 2px;
}

.hero-subtitle {
  display: block;
  margin-top: 22px;
  font-size: 18px;
  line-height: 1.8;
  color: rgba(23, 49, 98, 0.82);
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 28px;
}

.hero-tag {
  padding: 10px 16px;
  border-radius: 999px;
  background: rgba(22, 70, 159, 0.08);
  color: var(--brand-ink);
  font-size: 14px;
  font-weight: 600;
}

.hero-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
  margin-top: 34px;
}

.hero-btn {
  min-width: 164px;
  padding: 15px 24px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 700;
  text-align: center;
  transition: transform 0.28s ease, box-shadow 0.28s ease, background 0.28s ease;
}

.hero-btn:hover {
  transform: translateY(-2px);
}

.hero-btn-primary {
  background: linear-gradient(135deg, #16469f 0%, #0f5fcf 100%);
  color: #fff;
  box-shadow: 0 18px 34px rgba(22, 70, 159, 0.24);
}

.hero-btn-secondary {
  background: rgba(255, 255, 255, 0.72);
  border: 1px solid rgba(22, 70, 159, 0.14);
  color: var(--brand-blue);
}

.hero-brand {
  flex: 1 1 420px;
  display: flex;
  justify-content: center;
}

.brand-card {
  width: 100%;
  max-width: 480px;
  padding: 26px;
  border-radius: 34px;
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(22, 70, 159, 0.12);
  box-shadow: 0 26px 64px rgba(23, 49, 98, 0.12);
  backdrop-filter: blur(10px);
}

.brand-logo {
  width: 100%;
  display: block;
}

.brand-caption {
  display: block;
  margin-top: 18px;
  text-align: center;
  font-size: 15px;
  line-height: 1.7;
  color: rgba(23, 49, 98, 0.72);
}

.capability-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 18px;
}

.capability-card {
  padding: 26px;
  border-radius: 26px;
  background: rgba(255, 255, 255, 0.84);
  border: 1px solid var(--brand-line);
  box-shadow: 0 18px 42px rgba(23, 49, 98, 0.08);
}

.capability-title {
  display: block;
  font-size: 24px;
  font-weight: 700;
  color: var(--brand-blue);
}

.capability-description {
  display: block;
  margin-top: 14px;
  font-size: 15px;
  line-height: 1.85;
  color: rgba(23, 49, 98, 0.76);
}

.story-panel {
  margin-top: 22px;
  padding: 34px;
  border-radius: 32px;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.88), rgba(244, 250, 246, 0.96));
  border: 1px solid rgba(22, 70, 159, 0.12);
  box-shadow: 0 24px 54px rgba(23, 49, 98, 0.1);
}

.story-kicker {
  display: block;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 2px;
  text-transform: uppercase;
  color: #0ea74a;
}

.story-title {
  display: block;
  margin-top: 14px;
  font-size: 34px;
  line-height: 1.28;
  font-weight: 800;
}

.story-description {
  display: block;
  margin-top: 18px;
  max-width: 760px;
  font-size: 16px;
  line-height: 1.85;
  color: rgba(23, 49, 98, 0.76);
}

.story-signal-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 28px;
}

.story-signal-card {
  padding: 22px;
  border-radius: 24px;
  background: rgba(22, 70, 159, 0.06);
  border: 1px solid rgba(22, 70, 159, 0.08);
}

.story-signal-label {
  display: block;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 1px;
  color: rgba(22, 70, 159, 0.8);
}

.story-signal-value {
  display: block;
  margin-top: 12px;
  font-size: 18px;
  line-height: 1.7;
  font-weight: 600;
  color: var(--brand-ink);
}

@keyframes fade-rise {
  from {
    opacity: 0;
    transform: translateY(24px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media screen and (max-width: 960px) {
  .welcome-shell {
    padding: 52px 18px 72px;
  }

  .hero-title {
    font-size: 52px;
  }

  .capability-grid,
  .story-signal-grid {
    grid-template-columns: 1fr;
  }
}

@media screen and (max-width: 640px) {
  .welcome-shell {
    padding-top: 36px;
  }

  .hero-title {
    font-size: 38px;
    letter-spacing: 1px;
  }

  .hero-subtitle,
  .story-description,
  .story-signal-value {
    font-size: 15px;
  }

  .hero-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .hero-btn {
    width: 100%;
  }

  .brand-card,
  .capability-card,
  .story-panel {
    padding: 22px;
  }

  .story-title {
    font-size: 28px;
  }
}
</style>
