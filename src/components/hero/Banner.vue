<template>
  <div>
<!--    <div class="mb-8 text-center">-->
<!--      <img alt="mpwt-logo" class="page-logo" :src="logo">-->
<!--      <h1 class="text-h5 font-weight-bold">{{ $t('MPWT') }}</h1>-->
<!--      <div class="text-body-2 font-weight-light mb-n1">{{ $t('welcome') }}</div>-->
<!--    </div>-->

    <v-row>
      <v-col cols="12">
        <v-carousel
          cycle
          height="250"
          hide-delimiter-background
          :interval="12000"
          show-arrows="hover"
        >
          <v-carousel-item
            v-for="(slide, i) in slides"
            :key="i"
          >
            <v-card
              class="py-4"
              :class="slide.class"
              height="250"
              rounded="lg"
            >
              <template #title>
                <h2 class="text-h5 font-weight-bold text-white">
                  {{ slide.title }}
                </h2>
              </template>

              <template #subtitle>
                <div class="text-subtitle-1 text-white">
                  {{ slide.subtitle }}
                </div>
              </template>
              <v-card-item>
                <v-btn
                  :append-icon="slide.buttonIcon"
                  class="text-white"
                  variant="text"
                  @click="$router.push(slide.link)"
                >
                  {{ slide.buttonText }}
                </v-btn>
              </v-card-item>
            </v-card>
          </v-carousel-item>
        </v-carousel>
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
  import logo from '@/assets/mpwt-logo-sm.svg'
  /**
   * Dynamic Banner Carousel Component
   *
   * This component displays an auto-sliding carousel for announcements, promotions, and featured content.
   *
   * Configuration:
   * - Auto-slides every 5 seconds (interval: 5000ms)
   * - Arrows appear on hover for manual navigation
   * - Smooth transitions between slides with background zoom animation
   *
   * To add/edit slides:
   * 1. Add new object to 'slides' array with:
   *    - title: Main heading text
   *    - subtitle: Supporting description text
   *    - buttonText: Call-to-action button label
   *    - buttonIcon: Material Design Icon (mdi-*)
   *    - link: Router path for navigation
   *    - class: CSS class for styling (gradient-overlay-1 to 4)
   *
   * To customize background images:
   * - Edit the gradient-overlay-* classes in the <style> section
   * - Update the url() to your image URL
   * - Adjust gradient colors as needed
   *
   * Example slide object:
   * {
   *   title: 'Announcement Title',
   *   subtitle: 'Brief description of the announcement',
   *   buttonText: 'Learn More',
   *   buttonIcon: 'mdi-arrow-right',
   *   link: '/your-page',
   *   class: 'gradient-overlay-1',
   * }
   */
  const slides = [
    {
      title: 'អរគុណសន្ដិភាព',
      subtitle: 'កម្ពុជាត្រូវការសន្ដិភាពដើម្បីអភិវឌ្ឍន៍ និងរីកចម្រើន។',
      buttonText: 'ចាប់ផ្ដើមសេវាកម្ម',
      buttonIcon: 'mdi-arrow-right',
      link: '/service',
      class: 'gradient-overlay-1',
    },
    {
      title: 'សេវាកម្មឌីជីថលទំនើប',
      subtitle: 'គ្រប់គ្រងឯកសារ និងពាក្យស្នើសុំរបស់អ្នកតាមអនឡាញ។',
      buttonText: 'ស្វែងយល់បន្ថែម',
      buttonIcon: 'mdi-arrow-right',
      link: '/app',
      class: 'gradient-overlay-2',
    },
    {
      title: 'ប្រឡងយកប័ណ្ណបើកបរ',
      subtitle: 'ដាក់ពាក្យប្រឡងយកប័ណ្ណបើកបរថ្មី ឬបន្ដសុពលភាពងាយស្រួល។',
      buttonText: 'ចុះឈ្មោះឥឡូវនេះ',
      buttonIcon: 'mdi-arrow-right',
      link: '/service',
      class: 'gradient-overlay-3',
    },
    {
      title: 'ដាក់ពាក្យឆៀកតាមអនឡាញ',
      subtitle: 'ដាក់ពាក្យ និងបន្ដសុពលភាពឆៀករថយន្តរបស់អ្នកយ៉ាងលឿន។',
      buttonText: 'ដាក់ពាក្យឥឡូវនេះ',
      buttonIcon: 'mdi-arrow-right',
      link: '/service',
      class: 'gradient-overlay-4',
    },
  ]
</script>

<style scoped lang="scss">
.gradient-overlay-1 {
  background: linear-gradient(92deg, #192879 -6.36%, rgba(225, 77, 83, 0.50) 59.78%, rgba(227, 161, 82, 0.00) 98.65%), url("https://www.benoitproperties.com/wp-content/uploads/2023/10/Cambodia-tourism.png") lightgray;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
}

.gradient-overlay-2 {
  //background: linear-gradient(120deg, #1e3c72 0%, #2a5298 50%, rgba(74, 144, 226, 0.8) 100%), url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200") lightgray;
  background: linear-gradient(92deg, #192879 -6.36%, rgba(225, 77, 83, 0.50) 59.78%, rgba(227, 161, 82, 0.00) 98.65%), url("https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=1200") lightgray;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
}

.gradient-overlay-3 {
  //background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, rgba(118, 75, 162, 0.7) 100%), url("https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200") lightgray;
  background: linear-gradient(92deg, #192879 -6.36%, rgba(225, 77, 83, 0.50) 59.78%, rgba(227, 161, 82, 0.00) 98.65%), url("https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?w=1200") lightgray;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
}

.gradient-overlay-4 {
  //background: linear-gradient(90deg, #f093fb 0%, #f5576c 50%, rgba(245, 87, 108, 0.8) 100%), url("https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200") lightgray;
  background: linear-gradient(92deg, #192879 -6.36%, rgba(225, 77, 83, 0.50) 59.78%, rgba(227, 161, 82, 0.00) 98.65%), url("https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200") lightgray;
  background-size: cover;
  background-position: center;
  position: relative;
  overflow: hidden;
}

/* Add animation to backgrounds */
.gradient-overlay-1::before,
.gradient-overlay-2::before,
.gradient-overlay-3::before,
.gradient-overlay-4::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: inherit;
  animation: backgroundZoom 20s ease-in-out infinite;
  z-index: 0;
}

@keyframes backgroundZoom {
  0%, 100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.08);
  }
}

/* Ensure content is above the animated background */
.v-card :deep(.v-card-item),
.v-card :deep(.v-card-title),
.v-card :deep(.v-card-subtitle) {
  position: relative;
  z-index: 1;
}

/* Smooth fade transition for carousel */
:deep(.v-carousel__item) {
  transition: opacity 0.8s ease-in-out;
}

:deep(.v-carousel) {
  border-radius: 8px;
  overflow: hidden;
}

/* Style carousel arrows */
:deep(.v-carousel__controls) {
  background: transparent;
}

:deep(.v-btn--icon) {
  background: rgba(255, 255, 255, 0.2);
  backdrop-filter: blur(10px);
  transition: all 0.3s ease;
}

:deep(.v-btn--icon:hover) {
  background: rgba(255, 255, 255, 0.4);
  transform: scale(1.1);
}

/* Style carousel indicators */
:deep(.v-carousel__controls__item) {
  opacity: 0.5;
  transition: opacity 0.3s ease;
}

:deep(.v-carousel__controls__item--active) {
  opacity: 1;
}

.page-logo {
  height: 6rem;
}
</style>
