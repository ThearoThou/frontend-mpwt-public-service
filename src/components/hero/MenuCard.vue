<template>
  <div class="d-flex flex-wrap justify-space-between">
    <h2 class="text-h5 font-weight-bold my-4">
      {{ $t('publicService') }}
    </h2>
    <!--    <h2 class="text-h6 my-4 text-primary">-->
    <!--      មើលទាំងអស់-->
    <!--    </h2>-->
  </div>

  <v-row>
    <v-col
      v-for="menu in menus"
      :key="menu.href"
      cols="12"
      md="4"
      sm="6"
    >
      <v-card
        class="py-4 custom-card"
        elevation="0"
        :prepend-icon="menu.icon"
        rel="noopener noreferrer"
        rounded="lg"
        :subtitle="menu.subtitle"
        :title="menu.title"
        @click="navigateTo(menu.href)"
      >
        <template #prepend>
          <v-btn color="primary" :icon="menu.icon" size="large" variant="tonal" />
        </template>
      </v-card>
    </v-col>
  </v-row>

  <div class="d-flex flex-wrap justify-space-between">
    <h2 class="text-h5 font-weight-bold my-4">
      {{ $t('applications') }}
    </h2>
    <!--    <h2 class="text-h6 my-4 text-primary">-->
    <!--      មើលទាំងអស់-->
    <!--    </h2>-->
  </div>

  <v-row>
    <v-col
      v-for="app in apps"
      :key="app.href"
      cols="12"
      md="4"
      sm="6"
    >
      <v-card
        class="py-4 custom-card"
        elevation="0"
        :prepend-icon="app.icon"
        rel="noopener noreferrer"
        rounded="lg"
        :subtitle="app.subtitle"
        :title="app.title"
        @click="navigateTo(app.href)"
      >
        <template #prepend>
          <v-btn color="primary" :icon="app.icon" size="large" variant="tonal" />
        </template>
      </v-card>
    </v-col>
  </v-row>
</template>
<script setup lang="ts">
  import { useRouter } from 'vue-router'

  const router = useRouter()

  const menus = computed(() => [
    {
      href: '/services/inspection',
      icon: 'carbon:vehicle-connected',
      subtitle: 'ដាក់ពាក្យ បន្ដសុពលភាពឆៀក',
      title: 'ដាក់ពាក្យឆៀក',
    },
    {
      href: 'https://vuetifyjs.com/introduction/why-vuetify/#feature-guides',
      icon: 'streamline-flex:street-road-remix',
      subtitle: 'បញ្ចូលសមតុល្យផ្លូវល្បឿនលឿន',
      title: 'បញ្ចូលសមតុល្យ',
    },
    {
      href: 'https://vuetifyjs.com/components/all',
      icon: 'healthicons:i-exam-multiple-choice-outline',
      subtitle: 'ដាក់ពាក្យប្រឡងយកប័ណ្ណបើកបរថ្មី ឬបន្ដ',
      title: 'ប្រឡងយកប័ណ្ណបើកបរ',
    },
    {
      href: 'https://discord.vuetifyjs.com',
      icon: 'fluent:vehicle-motorcycle-24-regular',
      subtitle: 'ទិញយកលេខសម្គាល់ម៉ូតូ ចុះបញ្ជីម៉ូតូ',
      title: 'លេខសម្គាល់ម៉ូតូ',
    },
    {
      href: 'https://discord.vuetifyjs.com',
      icon: 'uil:ship',
      subtitle: 'ដាក់ពាក្យអាជ្ញាប័ណ្ណនាវាចូលប្រទេសកម្ពុជា',
      title: 'អជ្ញាប័ណ្ណនាវាចូល',
    },
    {
      href: 'https://discord.vuetifyjs.com',
      icon: 'fluent:vehicle-truck-cube-24-regular',
      subtitle: 'ស្នើសុំអាជ្ញាប័ណ្ណដឹកជញ្ជូនផ្លូវគោក',
      title: 'អជ្ញាប័ណ្ណដឹកជញ្ជូន',
    },
  ])

  const apps = computed(() => [
    {
      href: 'https://vuetifyjs.com/',
      icon: 'carbon:police',
      subtitle: 'ពិនិត្យពិន្ទុប័ណ្ណបើកបរ អនឡាញ',
      title: 'ពិនិត្យពិន្ទុប័ណ្ណបើកបរ',
    },
    {
      href: 'apps/service-tracking',
      icon: 'carbon:batch-job-step',
      subtitle: 'បញ្ចូលលេខវិកយបត្រ និងតាមដានស្ថានភាព',
      title: 'តាមដានដំណើរការសេវា',
    },
    {
      href: 'https://vuetifyjs.com/components/all',
      icon: 'material-symbols:account-balance-wallet-outline',
      subtitle: 'បញ្ចូលស្លាកលេខរថយន្ត ដើម្បីពិនិត្យសមតុល្យផ្លូវល្បឿន',
      title: 'ពិនិត្យសមតុល្យផ្លូវល្បឿន',
    },
    {
      href: 'https://discord.vuetifyjs.com',
      icon: 'fa7-solid:list-check',
      subtitle: 'ផ្ទៀងផ្ទាត់ព័ត៌មានរថយន្ដ និងម៉ូតូ',
      title: 'ផ្ទៀងផ្ទាត់ព័ត៌មាន',
    },
    {
      href: 'https://discord.vuetifyjs.com',
      icon: 'lucide-lab:motor-racing-helmet',
      subtitle: 'ស្នើសុំស្ទីគឃ័រម៉ូតូសម្រាប់ផ្លូវល្បឿនលឿន',
      title: 'ស្ទីគឃ័រម៉ូតូ',
    },
  ])

  function navigateTo (href: string) {
    router.push(href)
  }

</script>
<style scoped lang="scss">
  .custom-card {
    position: relative;
    z-index: 1; /* Keeps content above background */
  }
  //.custom-card::before {
  //  content: "";
  //  position: absolute;
  //  top: 0; left: 0; width: 100%; height: 100%;
  //  background-image: url("../../assets/ornament.svg");
  //  background-repeat: no-repeat;
  //  background-position: right;
  //  background-size: 150px;
  //  background-position-x: calc(100% + 6rem);
  //  opacity: 0.3;
  //  z-index: -1; /* Places the background behind content */
  //  transition: background-position-x 0.3s ease;
  //  //transform: rotate(90deg);
  //}
  //.custom-card:hover::before {
  //  background-position-x: calc(100% + 5.8rem);
  //}
</style>
