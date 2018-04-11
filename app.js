Vue.component('light', {
  template: `<path
    :class='[ "light-box", styles ]'
    @mousedown='handle_down'
    @mouseup='handle_up'
  />`,
  props: [ 'color', 'create_sound', 'current', 'disabled', 'duration', 'frequency', 'signal', 'mode' ],
  data: function () {
    return {
      lit: false,
      sound: null
    }
  },
  computed: {
    styles: function () {
      let style = {}
      let one_color = this.mode === 'one-color' || this.mode === 'both'
      style[one_color ? 'yellow' : this.color] = true
      style.lit = this.lit
      return style
    }
  },
  watch: {
    signal: function () {
      if (this.signal === this.color) {
        this.pulse()
      }
    }
  },
  methods: {
    pulse: function () {
      this.lit = true
      setTimeout(() => {
        this.lit = false
      }, this.duration * .75)
    },
    handle_down: function () {
      if (this.disabled) return
      this.$emit('answer', this.color)
      this.sound = this.create_sound(this.frequency, this.current.color === this.color)
      this.sound.start()
      this.lit = true
    },
    handle_up: function () {
      this.sound.stop()
      this.lit = false
    }
  }
})

let app = new Vue({
  el:'#root',
  data: {
    audio: {
      context: null,
      sound: null
    },
    config: {
      lights: [
        { color: 'blue', frequency: 195.998, path_description: 'M 2.5,0.25 l 0,1 l 1,0 a 1,1 0 0,0 -1,-1' },
        { color: 'yellow', frequency: 261.626, path_description: 'M 1.5,1.25 l 1,0 l 0,-1 a 1,1 0 0,0 -1,1' },
        { color: 'red', frequency: 329.628, path_description: 'M 2.5,2.25 l 0,-1 l -1,0 a 1,1 0 0,0 1,1' },
        { color: 'green', frequency: 391.995, path_description: 'M 3.5,1.25 l -1,0 l 0,1 a 1,1 0 0,0 1,-1' }
      ],
      levels: [
        { steps: 8, x: '2.64', y: '1.33', text: '1' },
        { steps: 20, x: '2.675', y: '1.33', text: '2' },
        { steps: 35, x: '2.715', y: '1.33', text: '3' },
        { steps: 50, x: '2.755', y: '1.33', text: '4' },
        { steps: 99, x: '2.795', y: '1.33', text: '∞' }
      ],
      modes: [ 'standard', 'one-color', 'mute', 'both' ]
    },
    disabled: true,
    error: false,
    flash_display: false,
    position: 0,
    power: false,
    level_index: 1,
    mode_index: 0,
    sequence: [],
    signal: null,
    started: false,
    strict: false,
    timers: {
      error: null,
      flash: null,
      learn_phase: null,
      response_phase: null
    },
    victory: false
  },
  computed: {
    difficulty_toggle_style: function () {
      const distance = [ 0, .0375, .075, .115, .155 ]
      return `translate(${ distance[this.level_index] })`
    },
    display: function () {
      if (!this.power) return ''
      if (this.victory) {
        this.flash()
        setTimeout(() => { this.victory = false }, 1000)
        return ':D'
      }
      if (this.power && !this.sequence.length) return '--'
      if (this.error) {
        this.flash()
        setTimeout(() => { this.error = false }, this.duration)
        return '!!'
      }
      if (this.sequence.length <= 9) {
        return '0' + this.sequence.length
      }
      return this.sequence.length
    },
    display_text_style: function () {
      return { 'display-text': true, flash: this.flash_display }
    },
    duration: function () {
      if (this.sequence.length < 5) return 1250
      if (this.sequence.length < 9) return 1000
      if (this.sequence.length < 13) return 750
      return 600
    },
    game_mode_toggle_style: function () {
      const distance = [ -0.005, .05, .105, .16 ]
      return `translate(${ distance[this.mode_index] })`
    },
    mode: function () {
      return this.config.modes[this.mode_index]
    },
    power_button_style: function () {
      return !this.power ? 'translate(-0.07)' : ''
    },
    strict_button_style: function () {
      return { 'light-box': true, lit: this.strict, unpowered: !this.power }
    },
    start_button_style: function () {
      return { 'light-box': true, lit: this.started, unpowered: !this.power }
    }
  },
  created: function () {
    try {
      this.audio.context = new (window.AudioContext || window.webkitAudioContext)()
    } catch (error) {
      alert(`Error your browser doesn\'t support the Web Audio API!\n${ error }`)
    }
  },
  methods: {
    start: _.debounce(function () {
      this.flash()
      if (this.started) this.reset()
      this.started = true
      !this.sequence.length && this.sequence.push(this.random_light())
      this.play()
    }, 50),
    play: function () {
      this.disabled = true
      this.timers.learn_phase = setInterval(() => {
        this.signal = this.sequence[this.position].color
        this.audio.sound = this.create_sound(this.sequence[this.position].frequency, true)
        this.play_sound(this.duration * .75 / 1000)
        Vue.nextTick(this.clear)
      }, this.duration)
    },
    clear: function () {
      this.signal = null
      this.position++
      if (this.position === this.sequence.length) {
        this.clear_learn_phase()
        this.disabled = false
        this.start_response_timer()
        this.position = 0
      }
    },
    check_answer: function (answer) {
      this.sequence[this.position].color === answer ? this.correct() : this.wrong()
    },
    correct: function () {
      this.position++
      this.start_response_timer()
      if (this.position >= this.config.levels[this.level_index].steps) {
        this.cancel_response_timer()
        this.victory = true
        this.disabled = true
        this.sequence = []
        this.position = 0
      } else if (this.position === this.sequence.length) {
        this.cancel_response_timer()
        this.position = 0
        this.sequence.push(this.random_light())
        this.play()
      }
    },
    wrong: function () {
      this.disabled = true
      this.error = true
      this.sequence = this.strict ? [this.random_light()] : this.sequence
      this.cancel_response_timer()
      setTimeout(() => {
        this.position = 0
        this.play()
      }, this.duration * 1.5)
    },
    start_response_timer: function () {
      this.cancel_response_timer()
      this.timers.response_phase = setTimeout(() => {
        this.audio.sound = this.create_sound(_, false)
        this.play_sound(this.duration / 1000)
        this.wrong()
      }, 3 * this.duration)
    },
    cancel_response_timer: function () {
      clearTimeout(this.timers.response_phase)
      this.timers.response_phase = null
    },
    clear_learn_phase: function () {
      clearInterval(this.timers.learn_phase)
      this.timers.learn_phase = null
    },
    random_light: function () {
      return this.config.lights[Math.floor(Math.random() * this.config.lights.length)]
    },
    strict_mode: function () {
      this.strict = !this.strict
    },
    toggle_power: function () {
      this.power = !this.power
      this.reset()
    },
    toggle_slider: function (selected_option, options, sign) {
      if (sign === '+') {
        this[selected_option] = this[selected_option] === this.config[options].length - 1 ? this[selected_option] : this[selected_option] += 1
      } else {
        this[selected_option] = this[selected_option] === 0 ? this[selected_option] : this[selected_option] -= 1
      }
    },
    create_sound: function (frequency, isCorrect) {
      let oscillator = this.audio.context.createOscillator()
      oscillator.connect(this.audio.context.destination)
      if (this.mode === 'mute' || this.mode === 'both') return { start: ()=>{}, stop: ()=>{} }
      if (isCorrect) {
        oscillator.type = 'sine'
        oscillator.frequency.value = frequency
      } else {
        oscillator.type = 'triangle'
        oscillator.frequency.value = 110
      }
      return oscillator
    },
    play_sound: function (duration) {
      let now = this.audio.context.currentTime
      this.audio.sound.start(now)
      this.audio.sound.stop(now + duration)
    },
    reset: function () {
      this.sequence = []
      this.position = 0
      this.cancel_response_timer()
      this.clear_learn_phase()
      this.strict = false
      this.started = false
    },
    flash: function () {
      let count = 4
      this.timers.flash = setInterval(() => {
        count--
        this.flash_display = !this.flash_display
        if (!count) clearInterval(this.timers.flash)
      }, 250)
    },
    select_mode: function (property, index) {
      this[property] = index
    }
  }
})
