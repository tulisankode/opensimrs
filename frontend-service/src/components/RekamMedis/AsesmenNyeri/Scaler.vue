<template>
    <div class="relative h-0.5 bg-black mb-2 mx-8 grid grid-cols-10 text-center ">
        <!-- <div v-for="n in 10" :key="n" class="grid w-px h-2 grid-cols-10 text-center bg-black -top-2"></div> -->
    </div>
    <div class="grid grid-cols-10 font-bold text-center text-SM">
        <span v-for="n in 10" :key="n" class="">{{ n }}</span>
    </div>
</template>

