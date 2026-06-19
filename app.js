/* Tour de Skiftet — app logic. Reads global TRIP from data.js. */
(function () {
  'use strict';
  var T = window.TRIP || {};
  var P = T.places || {};

  /* ---------- Service worker ---------- */
  if ('serviceWorker' in navigator) {
    var hadController = !!navigator.serviceWorker.controller;
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (refreshing || !hadController) return;
      refreshing = true;
      window.location.reload();
    });
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').then(function (reg) {
        reg.update();
      }).catch(function (e) { console.warn('SW registration failed', e); });
    });
  }

  /* ---------- Helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function place(key) { return P[key] || { name: key, lat: null, lon: null }; }
  function hasCoord(p) { return p && typeof p.lat === 'number' && typeof p.lon === 'number'; }

  var WEEKDAYS_FI = ['Su', 'Ma', 'Ti', 'Ke', 'To', 'Pe', 'La'];
  var WEEKDAYS_FI_LONG = ['Sunnuntai', 'Maanantai', 'Tiistai', 'Keskiviikko', 'Torstai', 'Perjantai', 'Lauantai'];
  var MONTHS_FI = ['', 'tammi', 'helmi', 'maalis', 'huhti', 'touko', 'kesä', 'heinä', 'elo', 'syys', 'loka', 'marras', 'joulu'];

  function isoToDate(iso) { var p = iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDateFi(d) { return d.getDate() + '.' + (d.getMonth() + 1) + '.'; }
  function fmtDateLongFi(d) { return WEEKDAYS_FI_LONG[d.getDay()] + ' ' + d.getDate() + '. ' + MONTHS_FI[d.getMonth() + 1] + 'kuuta'; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function minutesOf(hhmm) { var p = hhmm.split(':'); return (+p[0]) * 60 + (+p[1]); }
  function hhmm(totalMin) { var h = Math.floor(totalMin / 60) % 24; var m = totalMin % 60; return pad(h) + ':' + pad(m); }

  /* E-bike pace */
  var EBIKE_KMH = (T.meta && T.meta.ebikeKmh) || 20;
  function rideMin(km) { return Math.round((km || 0) / EBIKE_KMH * 60); }
  function fmtDur(min) {
    if (!min) return '0 min';
    if (min < 60) return min + ' min';
    var h = Math.floor(min / 60), m = min % 60;
    return h + ' h' + (m ? ' ' + m + ' min' : '');
  }

  function runsOnDay(daysText, date) {
    if (!daysText) return true;
    var s = daysText.toLowerCase();
    if (/(päivit|joka päivä|daily|dagligen|ma\s*[-–]\s*su|ma\s*[-–]\s*sun|mon\s*[-–]\s*sun)/.test(s)) return true;
    var dow = date.getDay();
    var tokens = [
      [1, ['ma', 'mon', 'måndag']], [2, ['ti', 'tue', 'tisdag']], [3, ['ke', 'wed', 'onsdag']],
      [4, ['to', 'thu', 'torsdag']], [5, ['pe', 'fri', 'fredag']], [6, ['la', 'sat', 'lördag']], [0, ['su', 'sun', 'söndag']]
    ];
    if (/ma\s*[-–]\s*pe|mon\s*[-–]\s*fri/.test(s)) return dow >= 1 && dow <= 5;
    if (/pe\s*[-–]\s*su|fri\s*[-–]\s*sun/.test(s)) return dow === 5 || dow === 6 || dow === 0;
    if (/la\s*[-–]\s*su|sat\s*[-–]\s*sun|viikonlopp/.test(s)) return dow === 6 || dow === 0;
    var matched = false, any = false;
    tokens.forEach(function (t) {
      t[1].forEach(function (tok) {
        var re = new RegExp('(^|[^a-zä])' + tok + '([^a-zä]|$)');
        if (re.test(s)) { any = true; if (t[0] === dow) matched = true; }
      });
    });
    return any ? matched : true;
  }
  function scheduleRuns(s, date) {
    if (s && Array.isArray(s.dow)) return s.dow.indexOf(date.getDay()) >= 0;
    return runsOnDay(s ? s.days : '', date);
  }

  function windDirFi(deg) {
    if (deg == null) return '';
    var dirs = ['pohjoisesta', 'koillisesta', 'idästä', 'kaakosta', 'etelästä', 'lounaasta', 'lännestä', 'luoteesta'];
    var arrows = ['↓', '↙', '←', '↖', '↑', '↗', '→', '↘'];
    var i = Math.round(deg / 45) % 8;
    return { label: dirs[i], arrow: arrows[i] };
  }

  /* ---------- Canonical legs (clockwise order from data.js) ---------- */
  var CANON_LEGS = (T.legs || []).map(function (l) { return Object.assign({}, l); });

  /* ---------- Generate legs for a given direction ---------- */
  function generateLegs(dir) {
    var legs;
    if (dir === 'cw') {
      legs = CANON_LEGS.map(function (l) { return Object.assign({}, l); });
    } else {
      // CCW: reverse and swap from/to
      legs = CANON_LEGS.slice().reverse().map(function (l) {
        return Object.assign({}, l, { from: l.to, to: l.from });
      });
    }
    // Assign day tags: day=1 up to and including the leg whose to==='nasby', day=2 after
    var passedNasby = false;
    // In CW the overnight is at nasby (to===nasby). In CCW reversed legs, from===nasby is the start of day 2.
    // Strategy: for cw, leg.to==='nasby' is end of day 1.
    //           for ccw, reversed list: the overnight split is the same place; find the leg where original.to==='nasby'
    //           which after reversal becomes leg.from==='nasby'.
    legs.forEach(function (leg) {
      if (!passedNasby) {
        leg.day = 1;
        // CW: we're done with day1 after delivering TO nasby
        if (dir === 'cw' && leg.to === 'nasby') passedNasby = true;
        // CCW: reversed — the leg that departs FROM nasby is the first leg of day 2
        if (dir === 'ccw' && leg.from === 'nasby') { leg.day = 2; passedNasby = true; }
      } else {
        leg.day = 2;
      }
    });
    return legs;
  }

  /* ---------- displayName: strip " (...)" parenthetical suffixes ---------- */
  function displayName(key) {
    var p = place(key);
    var n = p.name || key;
    return n.replace(/\s*\([^)]*\)\s*$/, '').trim();
  }

  /* ---------- fmtKm: format km with Finnish decimal comma ---------- */
  function fmtKm(km) {
    if (km == null) return '—';
    var s = (+km).toFixed(km === Math.floor(km) ? 0 : 1);
    return s.replace('.', ',');
  }

  /* ---------- tripProgress: persisted { dateKey: { ferryId: 'HH:MM' } } ---------- */
  var PROGRESS_KEY = 'skiftet_progress_v1';

  function loadProgress() {
    try { return JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}'); } catch (e) { return {}; }
  }

  function saveProgress(prog) {
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify(prog)); } catch (e) {}
  }

  /* ---------- chooseDeparture / clearDeparture ---------- */
  function chooseDeparture(dateKey, ferryId, time) {
    var prog = loadProgress();
    if (!prog[dateKey]) prog[dateKey] = {};
    prog[dateKey][ferryId] = time;
    saveProgress(prog);
    renderDayPlan();
  }

  function clearDeparture(dateKey, ferryId) {
    var prog = loadProgress();
    if (prog[dateKey]) delete prog[dateKey][ferryId];
    saveProgress(prog);
    renderDayPlan();
  }

  /* ---------- openFerrySchedule ---------- */
  function openFerrySchedule(ferryId, dateKey) {
    showView('ferries');
    setFerryFilterToDate(dateKey);
    buildFerries();
    setTimeout(function () {
      var node = document.getElementById('ferry-' + ferryId);
      if (!node) return;
      node.scrollIntoView({ behavior: 'smooth', block: 'start' });
      node.classList.add('ferry-card--flash');
      setTimeout(function () { node.classList.remove('ferry-card--flash'); }, 1200);
    }, 120);
  }

  /* ---------- generateDayPlan (structured object version) ---------- */
  function generateDayPlan(dir, d1key, d2key) {
    var allLegs = T.legs || [];
    var d1 = isoToDate(d1key);
    var d2 = isoToDate(d2key);

    /* Build structured steps for one day */
    function buildDaySteps(dayNum, date) {
      var dayLegs = allLegs.filter(function (l) { return l.day === dayNum; });
      var steps = [];

      dayLegs.forEach(function (leg) {
        if (leg.mode === 'bike') {
          steps.push({
            type: 'bike',
            from: leg.from,
            to: leg.to,
            km: leg.km || 0,
            departMin: null,   // filled by forward pass below
            arriveMin: null
          });

        } else if (leg.mode === 'ferry') {
          var ferryId = leg.ferry;
          var fobj = (T.ferries || {})[ferryId];
          var vessel = fobj ? fobj.name : ferryId;
          var crossMin = (fobj && fobj.crossingMin) ? fobj.crossingMin : 30;
          var booking = fobj ? fobj.booking : 'no';
          var onDemand = false;
          var allTimes = [];

          if (fobj && fobj.schedules) {
            fobj.schedules.forEach(function (s) {
              var fromToMatch = (!s.from && !s.to) ||
                (s.from === leg.from && s.to === leg.to);
              if (fromToMatch && scheduleRuns(s, date)) {
                if ((s.times || []).length === 0) {
                  onDemand = true;
                } else {
                  allTimes = allTimes.concat(s.times || []);
                }
              }
            });
          }

          // De-dup and sort
          var seen = {};
          allTimes = allTimes.filter(function (t) {
            if (seen[t]) return false;
            seen[t] = true;
            return true;
          }).sort(function (a, b) { return minutesOf(a) - minutesOf(b); });

          steps.push({
            type: 'ferry',
            ferryId: ferryId,
            vessel: vessel,
            from: leg.from,
            to: leg.to,
            booking: booking,
            crossingMin: crossMin,
            onDemand: onDemand,
            departures: allTimes.map(function (t) {
              return { time: t, min: minutesOf(t), past: false, latestFeasible: false, reachable: false };
            }),
            chosenTime: null       // filled from tripProgress + forward pass
          });
        }
      });

      return steps;
    }

    /* Backward pass: compute latestFeasible per ferry. */
    function computeLatestFeasible(steps) {
      var nextFerryLatestMin = null;
      var bikePadToNextFerry = 0;

      for (var i = steps.length - 1; i >= 0; i--) {
        var s = steps[i];
        if (s.type === 'ferry') {
          if (!s.departures.length || s.onDemand) continue;
          var latestDepMin;
          if (nextFerryLatestMin === null) {
            latestDepMin = s.departures[s.departures.length - 1].min;
          } else {
            var deadline = nextFerryLatestMin - bikePadToNextFerry - s.crossingMin;
            latestDepMin = null;
            for (var j = s.departures.length - 1; j >= 0; j--) {
              if (s.departures[j].min <= deadline) { latestDepMin = s.departures[j].min; break; }
            }
            if (latestDepMin === null) {
              latestDepMin = s.departures[0].min;
            }
          }
          for (var k = 0; k < s.departures.length; k++) {
            if (s.departures[k].min === latestDepMin) s.departures[k].latestFeasible = true;
          }
          nextFerryLatestMin = latestDepMin;
          bikePadToNextFerry = 0;
        } else if (s.type === 'bike') {
          var ride = rideMin(s.km);
          var brk = s.km >= 40 ? 15 : 0;
          bikePadToNextFerry += ride + brk;
        }
      }
    }

    /* Forward pass: assign departure/arrival minutes. */
    function forwardPass(steps, dateKey) {
      var prog = loadProgress();
      var dayProg = prog[dateKey] || {};
      var currentMin = 9 * 60; // 09:00

      var nowMin = (function () {
        var n = new Date();
        return n.getHours() * 60 + n.getMinutes();
      })();
      var isToday = (isoToDate(dateKey).toDateString() === new Date().toDateString());

      for (var i = 0; i < steps.length; i++) {
        var s = steps[i];
        if (s.type === 'bike') {
          s.departMin = currentMin;
          var ride = rideMin(s.km);
          s.arriveMin = currentMin + ride;
          currentMin = s.arriveMin;
          if (s.km >= 40) currentMin += 15;

        } else if (s.type === 'ferry') {
          // Mark past departures (today only)
          if (isToday) {
            for (var j = 0; j < s.departures.length; j++) {
              if (s.departures[j].min < nowMin) s.departures[j].past = true;
            }
          }
          // Mark reachable: a departure is reachable if its time >= currentMin
          for (var k = 0; k < s.departures.length; k++) {
            s.departures[k].reachable = (s.departures[k].min >= currentMin);
          }

          // Determine chosen time
          var confirmed = dayProg[s.ferryId] || null;
          if (confirmed) {
            s.chosenTime = confirmed;
            var confMin = minutesOf(confirmed);
            currentMin = confMin + s.crossingMin;
          } else {
            s.chosenTime = null;
            // For scheduling downstream: pick earliest reachable
            var picked = null;
            for (var k = 0; k < s.departures.length; k++) {
              if (s.departures[k].reachable) { picked = s.departures[k]; break; }
            }
            if (!picked && s.departures.length) picked = s.departures[s.departures.length - 1];
            if (picked) currentMin = picked.min + s.crossingMin;
            else currentMin += s.crossingMin; // on-demand fallback
          }
        }
      }
    }

    function buildDay(dayNum, date, dateKey, title) {
      var dayLegs = allLegs.filter(function (l) { return l.day === dayNum; });
      var bikeKm = 0, bikeMin = 0;
      dayLegs.forEach(function (l) {
        if (l.mode === 'bike') { bikeKm += (l.km || 0); bikeMin += rideMin(l.km || 0); }
      });

      var steps = buildDaySteps(dayNum, date);
      computeLatestFeasible(steps);
      forwardPass(steps, dateKey);

      return {
        day: dayNum,
        date: dateKey,
        title: title,
        dir: dir,
        bikeKm: bikeKm,
        bikeMin: bikeMin,
        overnight: dayNum === 1
          ? 'Restaurang Sybarit B&B (Houtskär) — yö 1'
          : 'Peterzens Boathouse (Kustavi) — yö 2',
        steps: steps
      };
    }

    var title1 = dir === 'cw'
      ? 'Kustavi → Iniö → Houtskär'
      : 'Kustavi → Brändö → Houtskär ⚓';
    var title2 = dir === 'cw'
      ? 'Houtskär → Brändö → Kustavi ⚓'
      : 'Houtskär → Iniö → Kustavi';

    T.dayPlan = [
      buildDay(1, d1, d1key, title1),
      buildDay(2, d2, d2key, title2)
    ];
  }

  /* ---------- renderDayPlan ---------- */
  function renderDayPlan() {
    if (SELECTED) {
      (T.dayPlan || []).forEach(function (dayObj) {
        (dayObj.steps || []).forEach(function (s) {
          if (s.type === 'ferry') {
            s.departures.forEach(function (d) { d.reachable = false; d.past = false; });
            s.chosenTime = null;
          } else {
            s.departMin = null;
            s.arriveMin = null;
          }
        });
        var prog = loadProgress();
        var dayProg = prog[dayObj.date] || {};
        var nowMin = (function () {
          var n = new Date();
          return n.getHours() * 60 + n.getMinutes();
        })();
        var isToday = (isoToDate(dayObj.date).toDateString() === new Date().toDateString());
        var currentMin = 9 * 60;

        (dayObj.steps || []).forEach(function (s) {
          if (s.type === 'bike') {
            s.departMin = currentMin;
            s.arriveMin = currentMin + rideMin(s.km);
            currentMin = s.arriveMin;
            if (s.km >= 40) currentMin += 15;
          } else if (s.type === 'ferry') {
            if (isToday) {
              s.departures.forEach(function (d) { if (d.min < nowMin) d.past = true; });
            }
            s.departures.forEach(function (d) { d.reachable = (d.min >= currentMin); });
            var confirmed = dayProg[s.ferryId] || null;
            if (confirmed) {
              s.chosenTime = confirmed;
              currentMin = minutesOf(confirmed) + s.crossingMin;
            } else {
              var picked = null;
              for (var k = 0; k < s.departures.length; k++) {
                if (s.departures[k].reachable) { picked = s.departures[k]; break; }
              }
              if (!picked && s.departures.length) picked = s.departures[s.departures.length - 1];
              currentMin = picked ? picked.min + s.crossingMin : currentMin + s.crossingMin;
            }
          }
        });
      });
    }

    var dp = $('#dayPlan');
    dp.innerHTML = '';

    (T.dayPlan || []).forEach(function (dayObj) {
      var card = el('div', 'day-card');
      var d = isoToDate(dayObj.date);
      card.innerHTML =
        '<div class="day-card__head"><h3>Päivä ' + dayObj.day + ' · ' + dayObj.title + '</h3>' +
        '<span class="day-card__date">' + WEEKDAYS_FI[d.getDay()] + ' ' + fmtDateFi(d) + '</span></div>';

      var body = el('div', 'day-card__body');

      /* Ride total chip */
      if (dayObj.bikeKm > 0) {
        body.appendChild(el('div', 'day-card__ride',
          '🚲 ~' + fmtKm(Math.round(dayObj.bikeKm)) + ' km · ~' + fmtDur(dayObj.bikeMin) +
          ' pyöräaikaa (' + EBIKE_KMH + ' km/h)'));
      }

      /* Drive note for day 1 */
      if (dayObj.day === 1) {
        body.appendChild(el('div', 'day-card__row',
          '<span class="t">aamu</span><span>Aja autolla Kustaviin (Peterzens), pura pyörät.</span>'));
      }

      /* Render steps */
      var prog = loadProgress();
      var dayProg = prog[dayObj.date] || {};

      (dayObj.steps || []).forEach(function (s) {
        if (s.type === 'bike') {
          var tLabel = s.departMin != null ? hhmm(s.departMin) : '—';
          var text = '🚲 ' + displayName(s.from) + ' → ' + displayName(s.to) +
            ' · ' + fmtKm(s.km) + ' km · ~' + fmtDur(rideMin(s.km));
          var row = el('div', 'day-card__row');
          row.innerHTML = '<span class="t">' + tLabel + '</span><span>' + text + '</span>';
          body.appendChild(row);

        } else if (s.type === 'ferry') {
          body.appendChild(renderFerryStep(s, dayObj.date, dayProg));
        }
      });

      /* Overnight box */
      if (dayObj.overnight) {
        body.appendChild(el('div', 'day-card__overnight',
          '🛏 Yöpyminen: <b>' + dayObj.overnight + '</b>'));
      }

      card.appendChild(body);
      dp.appendChild(card);
    });
  }

  /* ---------- renderFerryStep: render one ferry step block ---------- */
  function renderFerryStep(s, dateKey, dayProg) {
    var confirmed = dayProg[s.ferryId] || null;

    var wrap = el('div', 'dp-ferry-block');

    /* Header row: icon + route + booking badge + Aikataulu link */
    var bookBadge = '';
    if (s.booking === 'yes') bookBadge = ' <span class="dp-badge dp-badge--book">Varaus pakollinen</span>';
    else if (s.booking === 'recommended') bookBadge = ' <span class="dp-badge dp-badge--book">Varaus suositeltu</span>';

    var head = el('div', 'dp-ferry-block__head');
    head.innerHTML =
      '<span class="dp-ferry-icon">⛴</span>' +
      '<div class="dp-ferry-route">' +
        '<span class="dp-ferry-from-to">' + displayName(s.from) + ' → ' + displayName(s.to) + '</span>' +
        bookBadge +
      '</div>' +
      '<a class="dp-ferry-sched-link" href="javascript:void(0)" role="button">Aikataulu →</a>';

    /* Wire Aikataulu link */
    head.querySelector('.dp-ferry-sched-link').addEventListener('click', function (e) {
      e.preventDefault();
      openFerrySchedule(s.ferryId, dateKey);
    });

    wrap.appendChild(head);

    /* Crossing duration sub-line */
    var sub = el('div', 'dp-ferry-block__sub',
      '~' + s.crossingMin + ' min ylitys');
    wrap.appendChild(sub);

    /* On-demand ferry */
    if (s.onDemand) {
      wrap.appendChild(el('div', 'dp-ferry-block__ondemand',
        '⏱ Kulkee tarvittaessa — ei kiinteää aikataulua'));
      if (confirmed) {
        /* Confirmed on-demand */
        var confRow = el('div', 'dp-ferry-block__confirmed');
        confRow.innerHTML = '✓ klo <b>' + confirmed + '</b>';
        var clrBtn = el('button', 'dp-clear-btn', 'nollaa');
        (function (dKey, fId) {
          clrBtn.addEventListener('click', function () { clearDeparture(dKey, fId); });
        }(dateKey, s.ferryId));
        confRow.appendChild(clrBtn);
        wrap.appendChild(confRow);
      } else {
        var ondemandPick = el('div', 'dp-ferry-block__pick-row');
        var pickBtn = el('button', 'dp-dep-chip dp-dep-chip--ondemand', 'Otin tämän vuoron');
        (function (fId, dKey) {
          pickBtn.addEventListener('click', function () {
            var now = new Date();
            var t = pad(now.getHours()) + ':' + pad(now.getMinutes());
            chooseDeparture(dKey, fId, t);
          });
        }(s.ferryId, dateKey));
        ondemandPick.appendChild(pickBtn);
        wrap.appendChild(ondemandPick);
      }
      return wrap;
    }

    /* No departures */
    if (!s.departures || !s.departures.length) {
      wrap.appendChild(el('div', 'dp-ferry-block__ondemand dp-ferry-block__none',
        '⚠️ Ei vuoroja tänä päivänä — tarkista operaattorilta'));
      return wrap;
    }

    /* Confirmed departure: compact confirmed bar + nollaa */
    if (confirmed) {
      var confBar = el('div', 'dp-ferry-block__confirmed');
      var arrMin = minutesOf(confirmed) + s.crossingMin;
      confBar.innerHTML = '✓ klo <b>' + confirmed + '</b> · perillä ~<b>' + hhmm(arrMin) + '</b>';
      var clrBtn2 = el('button', 'dp-clear-btn', 'nollaa');
      (function (dKey, fId) {
        clrBtn2.addEventListener('click', function () { clearDeparture(dKey, fId); });
      }(dateKey, s.ferryId));
      confBar.appendChild(clrBtn2);
      wrap.appendChild(confBar);
    }

    /* Departure chips grid */
    var grid = el('div', 'dp-dep-grid');

    s.departures.forEach(function (dep) {
      var cls = 'dp-dep-chip';
      if (confirmed && dep.time === confirmed) {
        cls += ' dp-dep-chip--chosen';
      } else if (dep.past) {
        cls += ' dp-dep-chip--past';
      } else if (!dep.reachable) {
        cls += ' dp-dep-chip--unreachable';
      } else if (dep.latestFeasible) {
        cls += ' dp-dep-chip--latest';
      }

      var chip = el('span', cls, dep.time);
      chip.title = dep.latestFeasible ? 'Viimeinen suositeltava lähtö' : '';

      /* Only tappable if not past and not already confirmed to a different time */
      var isTappable = !dep.past && !(confirmed && dep.time !== confirmed);
      if (isTappable) {
        chip.setAttribute('role', 'button');
        chip.setAttribute('tabindex', '0');
        (function (dKey, fId, time) {
          function doConfirm() {
            if (confirmed === time) {
              clearDeparture(dKey, fId);
            } else {
              chooseDeparture(dKey, fId, time);
            }
          }
          chip.addEventListener('click', doConfirm);
          chip.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); doConfirm(); }
          });
        }(dateKey, s.ferryId, dep.time));
      }

      grid.appendChild(chip);
    });

    wrap.appendChild(grid);

    /* Hint text when nothing confirmed */
    if (!confirmed) {
      var hint = el('div', 'dp-ferry-block__hint', 'Napauta vuoroa vahvistaaksesi: "otin tämän"');
      wrap.appendChild(hint);
    }

    return wrap;
  }

  /* ---------- Module-level selected option ---------- */
  var SELECTED = null;
  var autoDefault = false; // true when SELECTED is a non-persisted weather auto-default

  /* ---------- Tab navigation ---------- */
  var mapInited = false;
  var tabs = document.querySelectorAll('.tab');
  function showView(name) {
    document.querySelectorAll('.view').forEach(function (v) { v.classList.remove('view--active'); });
    var v = document.getElementById('view-' + name);
    if (v) v.classList.add('view--active');
    tabs.forEach(function (t) { t.classList.toggle('tab--active', t.getAttribute('data-view') === name); });
    if (name === 'map') {
      if (!mapInited) initMap();
      else if (window._map) setTimeout(function () { window._map.invalidateSize(); }, 60);
    }
    if (name === 'weather') ensureWeather();
    if (name === 'options') ensureOptions();
  }
  tabs.forEach(function (t) {
    t.addEventListener('click', function () { showView(t.getAttribute('data-view')); });
  });

  /* ---------- Net status ---------- */
  var netEl = $('#netStatus');
  function updateNet() {
    var on = navigator.onLine;
    netEl.textContent = on ? '● Verkossa' : '● Offline';
    netEl.classList.toggle('net-status--off', !on);
    var note = $('#mapOfflineNote');
    if (note) note.classList.toggle('hidden', on);
  }
  window.addEventListener('online', function () { updateNet(); ensureWeather(true); });
  window.addEventListener('offline', updateNet);
  updateNet();

  /* ---------- MAP ---------- */
  function pinIcon(cls, label) {
    var size = cls.indexOf('lodging') >= 0 ? 30 : (cls.indexOf('town') >= 0 ? 26 : 22);
    return L.divIcon({
      className: 'pin-wrap',
      html: '<div class="pin ' + cls + '"><span>' + (label || '') + '</span></div>',
      iconSize: [size, size], iconAnchor: [size / 2, size], popupAnchor: [0, -size + 2]
    });
  }
  function distLabel(mode, txt) {
    return L.divIcon({ className: '', html: '<div class="dist-label dist-label--' + mode + '">' + txt + '</div>', iconSize: [1, 1] });
  }

  var routeLayer = null;

  function drawRoute() {
    if (!window._map || !routeLayer) return;
    routeLayer.clearLayers();
    var map = window._map;
    var bounds = [];
    var legs = T.legs || [];

    legs.forEach(function (leg) {
      var a = place(leg.from), b = place(leg.to);
      if (!hasCoord(a) || !hasCoord(b)) return;
      var ferry = leg.mode === 'ferry';
      var txt = (ferry ? '⛴ ' : '🚲 ') + (leg.km != null ? leg.km + ' km' : '');
      if (!ferry) {
        var geom = window.ROUTE_GEOM && (
          ROUTE_GEOM[leg.from + '>' + leg.to] ||
          (ROUTE_GEOM[leg.to + '>' + leg.from] ? ROUTE_GEOM[leg.to + '>' + leg.from].slice().reverse() : null)
        );
        if (geom && geom.length >= 2) {
          L.polyline(geom, { color: '#e8590c', weight: 5, opacity: 0.9, dashArray: null, lineCap: 'round' }).addTo(routeLayer);
          geom.forEach(function (pt) { bounds.push(pt); });
          var midPt = geom[Math.floor(geom.length / 2)];
          L.marker(midPt, { icon: distLabel('bike', txt), interactive: false, keyboard: false }).addTo(routeLayer);
          return;
        }
      }
      var latlngs = [[a.lat, a.lon], [b.lat, b.lon]];
      bounds.push(latlngs[0], latlngs[1]);
      L.polyline(latlngs, {
        color: ferry ? '#1971c2' : '#e8590c',
        weight: ferry ? 4 : 5,
        opacity: 0.9,
        dashArray: ferry ? '2,10' : null,
        lineCap: 'round'
      }).addTo(routeLayer);
      var mid = [(a.lat + b.lat) / 2, (a.lon + b.lon) / 2];
      L.marker(mid, { icon: distLabel(ferry ? 'ferry' : 'bike', txt), interactive: false, keyboard: false }).addTo(routeLayer);
    });

    (T.spurs || []).forEach(function (sp) {
      var a = place(sp.from), b = place(sp.to);
      if (!hasCoord(a) || !hasCoord(b)) return;
      L.polyline([[a.lat, a.lon], [b.lat, b.lon]], { color: '#868e96', weight: 3, opacity: .7, dashArray: '4,7' }).addTo(routeLayer);
      bounds.push([b.lat, b.lon]);
    });

    // Re-add place markers and accommodations to routeLayer
    Object.keys(P).forEach(function (key) {
      var p = P[key];
      if (!hasCoord(p)) return;
      if (p.type === 'accommodation') return;
      var cls = 'pin--town', label = '';
      if (p.type === 'ferryTerminal') { cls = 'pin--ferry'; label = '⛴'; }
      else if (p.type === 'side' || p.type === 'sidetrip') cls = 'pin--side';
      else if (p.type === 'town' || p.type === 'village') cls = 'pin--town';
      var m = L.marker([p.lat, p.lon], { icon: pinIcon(cls, label), title: p.name }).addTo(routeLayer);
      m.bindPopup(placePopup(key, p));
      bounds.push([p.lat, p.lon]);
    });

    (T.accommodations || []).forEach(function (ac) {
      var lat = ac.lat, lon = ac.lon;
      if (lat == null && ac.place && hasCoord(place(ac.place))) { lat = place(ac.place).lat; lon = place(ac.place).lon; }
      if (lat == null) return;
      var m = L.marker([lat, lon], { icon: pinIcon('pin--lodging', '🛏'), title: ac.name, zIndexOffset: 1000 }).addTo(routeLayer);
      m.bindPopup('<b>🛏 Yö ' + ac.night + ': ' + ac.name + '</b><br><span class="popup-sub">' + (ac.address || '') + '</span>' +
        (ac.link ? '<br><a href="' + ac.link + '" target="_blank" rel="noopener">Lisätietoja ›</a>' : ''));
      bounds.push([lat, lon]);
    });

    function doFit() {
      if (bounds.length) map.fitBounds(bounds, { padding: [28, 28] });
      else map.setView([60.35, 21.2], 9);
    }
    doFit();
    // Ensure size is correct after potential layout shift
    setTimeout(function () { map.invalidateSize(); doFit(); }, 120);
    setTimeout(function () { map.invalidateSize(); doFit(); }, 500);

    // Expose doFit for fitBtn (wired in initMap, but update closure reference via window)
    window._doFit = doFit;
  }

  function initMap() {
    mapInited = true;
    var map = L.map('map', { zoomControl: true, attributionControl: true });
    window._map = map;
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18, crossOrigin: true, attribution: '© OpenStreetMap'
    }).addTo(map);

    routeLayer = L.layerGroup().addTo(map);
    drawRoute();

    $('#fitBtn').addEventListener('click', function () { if (window._doFit) window._doFit(); });
    setupRadar(map);
    $('#locateBtn').addEventListener('click', function () {
      map.locate({ setView: true, maxZoom: 13 });
    });
    map.on('locationfound', function (e) {
      L.circleMarker(e.latlng, { radius: 8, color: '#1971c2', fillColor: '#4dabf7', fillOpacity: .9, weight: 2 })
        .addTo(map).bindPopup('Olet tässä').openPopup();
    });
    map.on('locationerror', function () { alert('Sijaintia ei saatu. Salli paikannus selaimen asetuksista.'); });
  }

  function placePopup(key, p) {
    var onward = (T.legs || []).filter(function (l) { return l.from === key; })[0];
    var html = '<b>' + p.name + '</b>';
    if (p.island) html += ' <span class="popup-sub">' + p.island + '</span>';
    if (onward) {
      var to = place(onward.to);
      html += '<br><span class="popup-sub">' + (onward.mode === 'ferry' ? '⛴ Lautta' : '🚲 Pyöräily') +
        ' → ' + to.name + ': <b>' + (onward.km != null ? onward.km + ' km' : '') + '</b></span>';
    }
    return html;
  }

  /* ---------- ROUTE VIEW ---------- */
  function buildRoute() {
    var legs = T.legs || [];
    var bikeKm = 0, ferryKm = 0, ferryCount = 0, bikeMin = 0;
    legs.forEach(function (l) {
      if (l.mode === 'ferry') { ferryKm += (l.km || 0); ferryCount++; }
      else { bikeKm += (l.km || 0); bikeMin += rideMin(l.km); }
    });
    var sum = $('#routeSummary');
    sum.innerHTML = '';
    function chip(val, lbl) { var c = el('div', 'summary-chip', '<b>' + val + '</b><span>' + lbl + '</span>'); sum.appendChild(c); }
    chip(Math.round(bikeKm) + ' km', 'pyöräilyä');
    chip('~' + fmtDur(bikeMin), 'pyöräaika · ' + EBIKE_KMH + ' km/h');
    chip(ferryCount, 'lauttaväliä');
    chip((T.dayPlan ? T.dayPlan.length : 3) + ' pv', 'kesto · 2 yötä');

    var list = $('#legList');
    list.innerHTML = '';
    legs.forEach(function (l) {
      var a = place(l.from), b = place(l.to);
      var ferry = l.mode === 'ferry';
      var row = el('div', 'leg ' + (ferry ? 'leg--ferry' : 'leg--bike'));
      var icon = ferry ? '⛴️' : '🚲';
      var tag = ferry && l.ferry ? '<span class="leg__tag">aikataulu ›</span>' : '';
      var sub = '';
      if (ferry) {
        var fobj = (T.ferries || {})[l.ferry];
        if (fobj && fobj.crossingMin) sub = '<small>⛴ ~' + fobj.crossingMin + ' min</small>';
      } else if (l.km != null) {
        sub = '<small>~' + fmtDur(rideMin(l.km)) + '</small>';
      }
      row.innerHTML =
        '<div class="leg__icon">' + icon + '</div>' +
        '<div class="leg__main"><div class="leg__route">' + a.name + ' → ' + b.name + tag + '</div>' +
        '<div class="leg__meta">' + (l.island || (ferry ? 'Lauttaväli' : '')) + (l.note ? ' · ' + l.note : '') + '</div></div>' +
        '<div class="leg__dist">' + (l.km != null ? l.km + ' km' : '—') + sub + '</div>';
      if (ferry && l.ferry) {
        row.style.cursor = 'pointer';
        row.addEventListener('click', function () { showView('ferries'); setTimeout(function () { scrollToFerry(l.ferry); }, 80); });
      }
      list.appendChild(row);
    });

    renderDayPlan();
  }

  /* ---------- FERRIES VIEW ---------- */
  var selectedFerryDate = new Date();

  function buildFerryDayFilter() {
    var sel = $('#ferryDay');
    sel.innerHTML = '';
    var today = new Date(); today.setHours(0, 0, 0, 0);
    for (var i = 0; i < 9; i++) {
      var d = new Date(today.getTime() + i * 86400000);
      var o = document.createElement('option');
      o.value = i;
      o.textContent = (i === 0 ? 'Tänään · ' : (i === 1 ? 'Huomenna · ' : '')) + WEEKDAYS_FI_LONG[d.getDay()] + ' ' + fmtDateFi(d);
      sel.appendChild(o);
    }
    sel.value = 0;
    sel.addEventListener('change', function () {
      var i = +sel.value;
      selectedFerryDate = new Date(today.getTime() + i * 86400000);
      buildFerries();
    });
  }

  /* Set the ferry day filter to the ISO date key of the trip day's date */
  function setFerryFilterToDate(dateKey) {
    var sel = $('#ferryDay');
    if (!sel) return;
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var target = isoToDate(dateKey);
    var diff = Math.round((target.getTime() - today.getTime()) / 86400000);
    if (diff >= 0 && diff <= 8) {
      sel.value = diff;
      selectedFerryDate = target;
    }
  }

  function scrollToFerry(id) {
    var node = document.getElementById('ferry-' + id);
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* Compute which ferry ids are used on each trip day */
  function getTripDayFerryIds(dayNum) {
    return (T.legs || [])
      .filter(function (l) { return l.day === dayNum && l.mode === 'ferry' && l.ferry; })
      .map(function (l) { return l.ferry; });
  }

  function buildFerries() {
    var wrap = $('#ferryList');
    wrap.innerHTML = '';
    var ferries = T.ferries || {};
    var refDate = selectedFerryDate;
    var isToday = (new Date()).toDateString() === refDate.toDateString();
    var nowMin = (new Date()).getHours() * 60 + (new Date()).getMinutes();

    // Determine which trip day matches refDate (for highlight)
    var tripDay1FerryIds = [], tripDay2FerryIds = [];
    var tripHighlightFerryIds = [];
    if (SELECTED) {
      tripDay1FerryIds = getTripDayFerryIds(1);
      tripDay2FerryIds = getTripDayFerryIds(2);
      var refKey = new Intl.DateTimeFormat('sv-SE').format(refDate);
      if (refKey === SELECTED.d1key) tripHighlightFerryIds = tripDay1FerryIds;
      else if (refKey === SELECTED.d2key) tripHighlightFerryIds = tripDay2FerryIds;
    }

    var order = [];
    (T.legs || []).forEach(function (l) { if (l.ferry && order.indexOf(l.ferry) < 0) order.push(l.ferry); });
    Object.keys(ferries).forEach(function (k) { if (order.indexOf(k) < 0) order.push(k); });

    order.forEach(function (id) {
      var f = ferries[id];
      if (!f) return;
      var isTripFerry = tripHighlightFerryIds.indexOf(id) >= 0;
      var card = el('div', 'ferry-card' + (isTripFerry ? ' ferry-card--trip' : ''));
      card.id = 'ferry-' + id;

      var bookBadge = '';
      if (f.booking === 'yes') bookBadge = '<span class="badge badge--book">Varaus pakollinen</span>';
      else if (f.booking === 'recommended') bookBadge = '<span class="badge badge--book">Varaus suositeltu</span>';
      var freeBadge = f.price && /free|ilmai/i.test(f.price) ? '<span class="badge badge--free">Maksuton</span>' : '';

      var tripBadge = isTripFerry ? '<span class="badge badge--trip">Tämän päivän yhteys</span>' : '';

      card.appendChild(el('div', 'ferry-card__head',
        '<span class="icon">⛴️</span><div><h3>' + f.name + '</h3><div class="op">' + (f.operator || '') +
        (f.crossingMin ? ' · ylitys n. ' + f.crossingMin + ' min' : '') + '</div></div>'));

      var body = el('div', 'ferry-card__body');
      if (bookBadge || freeBadge || tripBadge) body.appendChild(el('div', '', bookBadge + ' ' + freeBadge + ' ' + tripBadge));

      var nextInfo = null;
      (f.schedules || []).forEach(function (s) {
        if (!scheduleRuns(s, refDate)) return;
        (s.times || []).forEach(function (t) {
          var mm = minutesOf(t);
          if (isToday && mm < nowMin) return;
          if (!nextInfo || mm < nextInfo.min) nextInfo = { min: mm, time: t, dir: s.direction };
        });
      });
      var totalTimes = (f.schedules || []).reduce(function (acc, x) { return acc + ((x.times || []).length); }, 0);
      var nextBox;
      if (totalTimes === 0) nextBox = el('div', 'ferry-next ferry-next--none', '⏱ Kulkee tarvittaessa — ei kiinteää aikataulua.');
      else if (nextInfo) nextBox = el('div', 'ferry-next', '⏱ Seuraava ' + (isToday ? 'tänään' : 'tuona päivänä') + ': <b>' + nextInfo.time + '</b> · ' + nextInfo.dir);
      else nextBox = el('div', 'ferry-next ferry-next--none', '⏱ Ei lähtöjä valitulle päivälle aikataulutiedoissa — tarkista operaattorilta.');
      body.appendChild(nextBox);

      (f.schedules || []).forEach(function (s) {
        var dir = el('div', 'ferry-dir');
        dir.appendChild(el('h4', '', s.direction + ' <span class="days">· ' + (s.days || '') + (s.season ? ' · ' + s.season : '') + '</span>'));
        var grid = el('div', 'time-grid');
        var runs = scheduleRuns(s, refDate);
        (s.times || []).forEach(function (t) {
          var cls = 'time-chip';
          if (runs && isToday) {
            if (minutesOf(t) < nowMin) cls += ' time-chip--past';
            else if (nextInfo && t === nextInfo.time && s.direction === nextInfo.dir) cls += ' time-chip--next';
          }
          grid.appendChild(el('span', cls, t));
        });
        if (!(s.times || []).length) grid.appendChild(el('span', 'time-chip', '—'));
        dir.appendChild(grid);
        body.appendChild(dir);
      });

      var meta = el('div', 'ferry-meta');
      if (f.note) meta.appendChild(el('div', '', f.note));
      (f.links || []).forEach(function (lk) {
        meta.appendChild(el('div', '', '🔗 <a href="' + lk.url + '" target="_blank" rel="noopener">' + lk.label + '</a>'));
      });
      body.appendChild(meta);
      card.appendChild(body);
      wrap.appendChild(card);
    });
  }

  /* ---------- WEATHER VIEW ---------- */
  var WX_KEY = 'skiftet_wx_fmi_v1';
  var wxLoaded = false, wxLoading = false;

  var SMART = {
    1: { e: '☀️', t: 'Selkeää' }, 2: { e: '🌤️', t: 'Enimmäkseen selkeää' },
    4: { e: '⛅', t: 'Puolipilvistä' }, 6: { e: '🌥️', t: 'Enimmäkseen pilvistä' },
    7: { e: '☁️', t: 'Pilvistä' }, 9: { e: '🌫️', t: 'Sumua' },
    11: { e: '🌦️', t: 'Tihkusadetta' }, 14: { e: '🌧️', t: 'Jäätävää tihkua' }, 17: { e: '🌧️', t: 'Jäätävää sadetta' },
    21: { e: '🌦️', t: 'Yksittäisiä sadekuuroja' }, 24: { e: '🌦️', t: 'Paikoin sadekuuroja' }, 27: { e: '🌧️', t: 'Sadekuuroja' },
    31: { e: '🌦️', t: 'Ajoittain heikkoa sadetta' }, 32: { e: '🌦️', t: 'Ajoittain sadetta' }, 33: { e: '🌧️', t: 'Ajoittain voimakasta sadetta' },
    34: { e: '🌧️', t: 'Ajoittain heikkoa sadetta' }, 35: { e: '🌧️', t: 'Ajoittain sadetta' }, 36: { e: '🌧️', t: 'Ajoittain voimakasta sadetta' },
    37: { e: '🌧️', t: 'Heikkoa sadetta' }, 38: { e: '🌧️', t: 'Sadetta' }, 39: { e: '🌧️', t: 'Voimakasta sadetta' },
    41: { e: '🌨️', t: 'Heikkoa räntää' }, 42: { e: '🌨️', t: 'Räntää' }, 43: { e: '🌨️', t: 'Voimakasta räntää' },
    44: { e: '🌨️', t: 'Heikkoa räntää' }, 45: { e: '🌨️', t: 'Räntää' }, 46: { e: '🌨️', t: 'Voimakasta räntää' },
    47: { e: '🌨️', t: 'Heikkoa räntää' }, 48: { e: '🌨️', t: 'Räntää' }, 49: { e: '🌨️', t: 'Voimakasta räntää' },
    51: { e: '🌨️', t: 'Heikkoa lumisadetta' }, 52: { e: '🌨️', t: 'Lumisadetta' }, 53: { e: '❄️', t: 'Sakeaa lumisadetta' },
    54: { e: '🌨️', t: 'Heikkoa lumisadetta' }, 55: { e: '❄️', t: 'Lumisadetta' }, 56: { e: '❄️', t: 'Sakeaa lumisadetta' },
    57: { e: '❄️', t: 'Heikkoa lumisadetta' }, 58: { e: '❄️', t: 'Lumisadetta' }, 59: { e: '❄️', t: 'Runsasta lumisadetta' },
    61: { e: '🌩️', t: 'Yksittäisiä raekuuroja' }, 64: { e: '🌩️', t: 'Paikoin raekuuroja' }, 67: { e: '🌩️', t: 'Raekuuroja' },
    71: { e: '⛈️', t: 'Yksittäisiä ukkoskuuroja' }, 74: { e: '⛈️', t: 'Paikoin ukkoskuuroja' }, 77: { e: '⛈️', t: 'Ukkoskuuroja' },
    101: { e: '🌙', t: 'Selkeää' }, 102: { e: '🌙', t: 'Enimmäkseen selkeää' }, 104: { e: '☁️', t: 'Puolipilvistä' },
    106: { e: '☁️', t: 'Enimmäkseen pilvistä' }, 107: { e: '☁️', t: 'Pilvistä' }
  };
  function symInfo(code) {
    if (code == null) return { e: '❓', t: '—' };
    var c = Math.round(code);
    return SMART[c] || SMART[c - 100] || { e: '❓', t: '—' };
  }

  function weatherSpots() {
    var spots = T.weatherSpots || [];
    return spots.map(function (s) {
      if (typeof s === 'string') { var p = place(s); return { name: p.name, lat: p.lat, lon: p.lon }; }
      return s;
    }).filter(function (s) { return typeof s.lat === 'number'; });
  }

  var FMI_PARAMS = ['Temperature', 'WindSpeedMS', 'WindDirection', 'Precipitation1h', 'SmartSymbol', 'PoP'];
  var NS_WML2 = 'http://www.opengis.net/waterml/2.0', NS_GML = 'http://www.opengis.net/gml/3.2';
  function fmiIso(d) { return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  function fmiUrl(lat, lon, days) {
    var now = new Date(), end = new Date(now.getTime() + days * 86400000);
    return 'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=GetFeature' +
      '&storedquery_id=fmi::forecast::edited::weather::scandinavia::point::timevaluepair' +
      '&latlon=' + lat.toFixed(4) + ',' + lon.toFixed(4) +
      '&parameters=' + FMI_PARAMS.join(',') +
      '&starttime=' + fmiIso(now) + '&endtime=' + fmiIso(end) + '&timestep=60';
  }
  function parseFmiTVP(xmlText) {
    var doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    var out = {};
    var series = doc.getElementsByTagNameNS(NS_WML2, 'MeasurementTimeseries');
    for (var i = 0; i < series.length; i++) {
      var s = series[i];
      var gid = s.getAttributeNS(NS_GML, 'id') || s.getAttribute('gml:id') || '';
      var param = gid.replace(/^mts-\d+-\d+-/, '');
      if (!param) continue;
      var arr = [], tvps = s.getElementsByTagNameNS(NS_WML2, 'MeasurementTVP');
      for (var j = 0; j < tvps.length; j++) {
        var te = tvps[j].getElementsByTagNameNS(NS_WML2, 'time')[0];
        var ve = tvps[j].getElementsByTagNameNS(NS_WML2, 'value')[0];
        if (!te) continue;
        var vs = ve ? ve.textContent.trim() : null;
        arr.push({ t: te.textContent.trim(), v: (!vs || vs === 'NaN') ? null : parseFloat(vs) });
      }
      out[param] = arr;
    }
    return out;
  }
  function hourInHelsinki(iso) {
    return +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Helsinki', hour: '2-digit', hour12: false }).format(new Date(iso));
  }
  function dayKeyHelsinki(iso) {
    return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Helsinki' }).format(new Date(iso));
  }
  function summarizeFmi(parsed) {
    function toMap(a) { var m = {}; (a || []).forEach(function (x) { m[x.t] = x.v; }); return m; }
    var times = (parsed.Temperature || []).map(function (x) { return x.t; });
    var mT = toMap(parsed.Temperature), mW = toMap(parsed.WindSpeedMS), mWD = toMap(parsed.WindDirection),
      mP = toMap(parsed.Precipitation1h), mS = toMap(parsed.SmartSymbol), mPOP = toMap(parsed.PoP);
    var nowMs = Date.now(), cur = null;
    for (var i = 0; i < times.length; i++) {
      if (new Date(times[i]).getTime() >= nowMs - 3600000) { var ct = times[i]; cur = { temp: mT[ct], wind: mW[ct], dir: mWD[ct], precip: mP[ct], sym: mS[ct], pop: mPOP[ct] }; break; }
    }
    if (!cur && times.length) { var t0 = times[0]; cur = { temp: mT[t0], wind: mW[t0], dir: mWD[t0], precip: mP[t0], sym: mS[t0], pop: mPOP[t0] }; }
    var days = {}, order = [];
    times.forEach(function (ts) {
      var k = dayKeyHelsinki(ts);
      if (!days[k]) { days[k] = { key: k, tmax: -99, tmin: 99, precip: 0, windMax: 0, windDir: null, pop: 0, noon: null, syms: {} }; order.push(k); }
      var d = days[k];
      var tv = mT[ts]; if (tv != null) { if (tv > d.tmax) d.tmax = tv; if (tv < d.tmin) d.tmin = tv; }
      var wv = mW[ts]; if (wv != null && wv > d.windMax) { d.windMax = wv; d.windDir = mWD[ts]; }
      var pv = mP[ts]; if (pv != null) d.precip += pv;
      var pp = mPOP[ts]; if (pp != null && pp > d.pop) d.pop = pp;
      var sv = mS[ts]; if (sv != null) { d.syms[sv] = (d.syms[sv] || 0) + 1; var h = hourInHelsinki(ts); if (h >= 12 && h <= 15 && d.noon == null) d.noon = sv; }
    });
    var dayList = order.map(function (k) {
      var d = days[k], best = null, bn = -1;
      for (var s in d.syms) { if (d.syms[s] > bn) { bn = d.syms[s]; best = +s; } }
      return { key: k, tmax: Math.round(d.tmax), tmin: Math.round(d.tmin), precip: d.precip, windMax: Math.round(d.windMax), windDir: d.windDir, pop: Math.round(d.pop), sym: d.noon != null ? d.noon : best };
    });
    return { current: cur, days: dayList };
  }

  function ensureWeather(force) {
    if (wxLoading) return;
    var spots = weatherSpots();
    if (!spots.length) { $('#weatherList').innerHTML = '<p class="muted">Ei sääpisteitä määritelty.</p>'; return; }
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(WX_KEY) || 'null'); } catch (e) {}
    if (cached && cached.data) { renderWeather(cached.data, cached.ts); wxLoaded = true; }
    if (!force && wxLoaded && navigator.onLine === false) return;
    if (!navigator.onLine) {
      if (!cached) $('#weatherList').innerHTML = '<p class="muted">Sääennustetta ei ole vielä ladattu. Yhdistä verkkoon kerran, niin se tallentuu offline-käyttöön.</p>';
      return;
    }
    fetchAllWeather(spots);
  }

  function fetchAllWeather(spots) {
    wxLoading = true;
    $('#weatherUpdated').textContent = 'Päivitetään (Ilmatieteen laitos)…';
    var days = 9;
    Promise.all(spots.map(function (s) {
      return fetch(fmiUrl(s.lat, s.lon, days))
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (xml) { return { name: s.name, sum: summarizeFmi(parseFmiTVP(xml)) }; })
        .catch(function (e) { console.warn('FMI fetch failed for', s.name, e); return { name: s.name, sum: null }; });
    })).then(function (results) {
      var ok = results.some(function (r) { return r.sum; });
      var ts = Date.now();
      if (ok) { try { localStorage.setItem(WX_KEY, JSON.stringify({ ts: ts, data: results })); } catch (e) {} }
      renderWeather(results, ts);
      wxLoaded = wxLoaded || ok; wxLoading = false;
      if (!ok && !wxLoaded) $('#weatherUpdated').textContent = 'Sään haku epäonnistui — yritä uudelleen.';
    });
  }

  function renderWeather(data, ts) {
    var wrap = $('#weatherList');
    wrap.innerHTML = '';
    var tripStart = T.meta && T.meta.tripStart ? T.meta.tripStart : null;
    var tripEnd = T.meta && T.meta.tripEnd ? T.meta.tripEnd : null;
    data.forEach(function (item) {
      var sum = item.sum;
      var card = el('div', 'wx-card');
      card.appendChild(el('div', 'wx-card__head', '<h3>📍 ' + item.name + '</h3>'));
      if (!sum) { card.appendChild(el('div', 'wx-now', '<div class="wx-now__detail muted">Ennustetta ei saatu</div>')); wrap.appendChild(card); return; }
      var c = sum.current;
      if (c) {
        var si = symInfo(c.sym), wd = windDirFi(c.dir);
        card.appendChild(el('div', 'wx-now',
          '<div class="wx-now__icon">' + si.e + '</div>' +
          '<div><div class="wx-now__temp">' + (c.temp != null ? Math.round(c.temp) : '–') + '°</div>' +
          '<div class="wx-now__detail">' + si.t + '<br><span class="wx-wind">💨 ' + (wd.arrow || '') + ' ' +
          (c.wind != null ? Math.round(c.wind) : '–') + ' m/s ' + (wd.label || '') + '</span>' +
          (c.pop != null ? ' · sade ' + Math.round(c.pop) + '%' : '') + '</div></div>'));
      }
      var days = el('div', 'wx-days');
      sum.days.forEach(function (d) {
        var si = symInfo(d.sym), wd = windDirFi(d.windDir);
        var p = d.key.split('-'), dd = new Date(+p[0], +p[1] - 1, +p[2]);
        var isTrip = tripStart && tripEnd && d.key >= tripStart && d.key <= tripEnd;
        var dayEl = el('div', 'wx-day' + (isTrip ? ' wx-day--trip' : ''));
        dayEl.innerHTML =
          '<div class="d">' + WEEKDAYS_FI[dd.getDay()] + ' ' + dd.getDate() + '.</div>' +
          '<div class="ic">' + si.e + '</div>' +
          '<div class="tmax">' + d.tmax + '°</div>' +
          '<div class="tmin">' + d.tmin + '°</div>' +
          '<div class="wnd">💨 ' + (wd.arrow || '') + ' ' + d.windMax + '</div>' +
          '<div class="pr">' + (d.pop != null ? d.pop + '%' : Math.round(d.precip) + 'mm') + '</div>';
        days.appendChild(dayEl);
      });
      card.appendChild(days);
      wrap.appendChild(card);
    });
    if (ts) {
      var dt = new Date(ts);
      $('#weatherUpdated').textContent = 'Päivitetty ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) +
        ' · Ilmatieteen laitos' + (navigator.onLine ? '' : ' · offline (tallennettu ennuste)');
    }
  }

  /* Re-render weather from cache with current trip highlight (called by applyOption) */
  function renderWeatherFromCache() {
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(WX_KEY) || 'null'); } catch (e) {}
    if (cached && cached.data) renderWeather(cached.data, cached.ts);
  }

  $('#refreshWeather').addEventListener('click', function () { ensureWeather(true); });

  /* ---------- OPTIONS VIEW ---------- */
  var OPT_KEY = 'skiftet_opts_v1';
  var SEL_KEY = 'skiftet_sel_v1';
  var optLoaded = false, optLoading = false;

  // Skiftet (Brändö↔Houtskär) runs only on the weekdays it has scheduled departures.
  function skiftetRunsOn(date) {
    var f = T.ferries && T.ferries.skiftet;
    if (!f || !f.schedules) return true;
    var dow = date.getDay();
    return f.schedules.some(function (s) {
      return s.dow && s.dow.indexOf(dow) >= 0 && (s.times || []).length > 0;
    });
  }
  function dateFromKey(k) { var p = k.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }

  function scoreOption(brWx, iniWx) {
    return brWx.pop * 1.0 + brWx.precip * 15 + brWx.windMax * 1.5
      + iniWx.pop * 0.4 + iniWx.precip * 5 - brWx.tmax * 0.4;
  }

  function brandoVerdict(brWx) {
    var parts = [];
    var si = symInfo(brWx.sym);
    parts.push(si.t);
    if (brWx.windMax <= 5) parts.push('tyyni');
    else if (brWx.windMax <= 8) parts.push('kohtalainen tuuli');
    else if (brWx.windMax <= 12) parts.push('navakka tuuli');
    else parts.push('kova tuuli');
    if (brWx.pop <= 15) parts.push('poutainen');
    else if (brWx.pop <= 40) parts.push('pilvipoutaa');
    else parts.push('saderiski');
    return parts.join(' · ');
  }

  function renderDayStrip(wx, label, highlight) {
    var si = symInfo(wx.sym);
    var wd = windDirFi(wx.windDir);
    var dateObj = dateFromKey(wx.key);
    var dayName = WEEKDAYS_FI[dateObj.getDay()] + ' ' + dateObj.getDate() + '.' + (dateObj.getMonth() + 1) + '.';
    var div = el('div', 'opt-day-strip' + (highlight ? ' opt-day-strip--highlight' : ''));
    div.innerHTML =
      '<div class="opt-day-label">' + label + '</div>' +
      '<div class="opt-day-date">' + dayName + '</div>' +
      '<div class="opt-day-icon">' + si.e + '</div>' +
      '<div class="opt-day-desc">' + si.t + '</div>' +
      '<div class="opt-day-temp">' + wx.tmax + '° <span class="opt-tmin">/ ' + wx.tmin + '°</span></div>' +
      '<div class="opt-day-wind">💨 ' + (wd.arrow || '') + ' ' + wx.windMax + ' m/s</div>' +
      '<div class="opt-day-rain">' + wx.pop + ' % sade</div>';
    return div;
  }

  /* ---------- applyOption ---------- */
  function applyOption(opt, noNav, noPersist) {
    var dir = opt.direction; // 'cw' or 'ccw'
    SELECTED = opt;
    autoDefault = !!noPersist; // a non-persisted auto default the user can still override

    // Update TRIP meta
    T.meta.direction = dir === 'cw' ? 'Myötäpäivään' : 'Vastapäivään';
    T.meta.tripStart = opt.d1key;
    T.meta.tripEnd = opt.d2key;

    // Regenerate legs and day plan
    T.legs = generateLegs(dir);
    generateDayPlan(dir, opt.d1key, opt.d2key);

    // Persist selection (skip for a soft auto-default so weather can re-pick next load)
    if (!noPersist) { try { localStorage.setItem(SEL_KEY, JSON.stringify({ direction: dir, d1key: opt.d1key, d2key: opt.d2key })); } catch (e) {} }

    // Update header subtitle and route title
    var sub = document.querySelector('.app-header__sub');
    if (sub) sub.textContent = 'Kustavi · Brändö · Houtskär · Iniö — ' + T.meta.direction.toLowerCase();
    var rt = document.getElementById('routeTitle');
    if (rt) rt.textContent = 'Reitti vaiheittain (' + T.meta.direction.toLowerCase() + ')';

    // Re-render route view
    buildRoute();

    // Redraw map if already open
    if (window._map && routeLayer) drawRoute();

    // Re-highlight weather from cache
    renderWeatherFromCache();

    // Set ferry filter to day 1 first, then rebuild so the trip-day highlight matches
    setFerryFilterToDate(opt.d1key);
    buildFerries();

    // Mark selected option card
    document.querySelectorAll('.opt-card').forEach(function (c) { c.classList.remove('opt-card--selected'); });
    document.querySelectorAll('.opt-choose').forEach(function (btn) {
      btn.textContent = 'Valitse tämä';
      btn.disabled = false;
    });
    // Find matching card by data attribute
    var selCard = document.querySelector('.opt-card[data-d1key="' + opt.d1key + '"][data-dir="' + dir + '"]');
    if (selCard) {
      selCard.classList.add('opt-card--selected');
      var btn = selCard.querySelector('.opt-choose');
      if (btn) { btn.textContent = 'Valittu ✓'; btn.disabled = true; }
    }

    // Navigate to route view (unless noNav)
    if (!noNav) showView('route');
  }

  function buildOptionsUI(options, ts) {
    var wrap = $('#optionsList');
    wrap.innerHTML = '';

    if (!options || !options.length) {
      wrap.innerHTML = '<p class="muted">Ei sopivia vaihtoehtoja ennustejaksolla (Skiftet ei liikennöi ma tai la).</p>';
      return;
    }

    options.forEach(function (opt, idx) {
      var isBest = idx === 0;
      var isSelected = SELECTED && SELECTED.direction === opt.direction &&
        SELECTED.d1key === opt.d1key && SELECTED.d2key === opt.d2key;
      var cardCls = 'opt-card' + (isBest ? ' opt-card--best' : '') + (isSelected ? ' opt-card--selected' : '');
      var card = el('div', cardCls);
      card.setAttribute('data-dir', opt.direction);
      card.setAttribute('data-d1key', opt.d1key);

      var dirIcon = opt.direction === 'cw' ? '⟳' : '⟲';
      var dirName = opt.direction === 'cw' ? 'Myötäpäivään' : 'Vastapäivään';
      var dirSub = opt.direction === 'cw'
        ? 'Pv 1: Iniö · Pv 2: Brändö (Skiftet-päivä)'
        : 'Pv 1: Brändö (Skiftet-päivä) · Pv 2: Iniö';
      var badge = isBest ? '<span class="opt-best-badge">⭐ Suositus</span>' : '';

      var head = el('div', 'opt-card__head');
      head.innerHTML =
        '<div class="opt-card__dir"><span class="opt-dir-icon">' + dirIcon + '</span>' +
        '<div><div class="opt-dir-name">' + dirName + '</div>' +
        '<div class="opt-dir-sub">' + dirSub + '</div></div></div>' + badge;
      card.appendChild(head);

      var body = el('div', 'opt-card__body');

      if (opt.direction === 'cw') {
        body.appendChild(renderDayStrip(opt.iniWx, 'Päivä 1 · Iniö', false));
        body.appendChild(renderDayStrip(opt.brWx,  'Päivä 2 · Brändö ⚓', true));
      } else {
        body.appendChild(renderDayStrip(opt.brWx,  'Päivä 1 · Brändö ⚓', true));
        body.appendChild(renderDayStrip(opt.iniWx, 'Päivä 2 · Iniö', false));
      }

      var verdict = el('div', 'opt-verdict');
      verdict.innerHTML = '<b>Brändö-päivä:</b> ' + brandoVerdict(opt.brWx);
      body.appendChild(verdict);

      // "Valitse" button
      var chooseBtnText = isSelected ? 'Valittu ✓' : 'Valitse tämä';
      var chooseBtn = el('button', 'opt-choose pill-btn', chooseBtnText);
      if (isSelected) chooseBtn.disabled = true;
      (function (capturedOpt) {
        chooseBtn.addEventListener('click', function () { applyOption(capturedOpt, false); });
      }(opt));
      body.appendChild(chooseBtn);

      card.appendChild(body);
      wrap.appendChild(card);
    });

    if (ts) {
      var dt = new Date(ts);
      $('#optionsUpdated').textContent = 'Päivitetty ' + pad(dt.getHours()) + ':' + pad(dt.getMinutes()) +
        ' · Ilmatieteen laitos' + (navigator.onLine ? '' : ' · offline');
    }
  }

  function computeOptions(wxData) {
    var avaDot = null, kannvikDot = null;
    wxData.forEach(function (item) {
      if (!item.sum) return;
      var n = item.name ? item.name.toLowerCase() : '';
      if (n.indexOf('åva') >= 0 || n.indexOf('ava') >= 0) avaDot = item.sum;
      if (n.indexOf('kannvik') >= 0) kannvikDot = item.sum;
    });
    var avail = wxData.filter(function (d) { return d.sum; });
    if (!avaDot && avail.length >= 1) avaDot = avail[0].sum;
    if (!kannvikDot && avail.length >= 2) kannvikDot = avail[1].sum;
    if (!avaDot || !kannvikDot) return [];

    var today = new Date(); today.setHours(0, 0, 0, 0);
    var avaDays = avaDot.days.filter(function (d) { return dateFromKey(d.key) >= today; });
    var kannvikDays = kannvikDot.days.filter(function (d) { return dateFromKey(d.key) >= today; });

    var iniMap = {};
    kannvikDays.forEach(function (d) { iniMap[d.key] = d; });

    var options = [];
    for (var i = 0; i < avaDays.length - 1; i++) {
      var d1wx = avaDays[i];
      var d2wx = avaDays[i + 1];
      var d1 = dateFromKey(d1wx.key);
      var d2 = dateFromKey(d2wx.key);
      var gap = (d2.getTime() - d1.getTime()) / 86400000;
      if (gap !== 1) continue;

      var iniD1 = iniMap[d1wx.key] || d1wx;
      var iniD2 = iniMap[d2wx.key] || d2wx;

      // CW: D1=Iniö, D2=Brändö. Skiftet runs D2.
      if (skiftetRunsOn(d2)) {
        options.push({
          direction: 'cw', d1key: d1wx.key, d2key: d2wx.key,
          brWx: d2wx, iniWx: iniD1,
          score: scoreOption(d2wx, iniD1)
        });
      }
      // CCW: D1=Brändö, D2=Iniö. Skiftet runs D1.
      if (skiftetRunsOn(d1)) {
        options.push({
          direction: 'ccw', d1key: d1wx.key, d2key: d2wx.key,
          brWx: d1wx, iniWx: iniD2,
          score: scoreOption(d1wx, iniD2)
        });
      }
    }

    options.sort(function (a, b) { return a.score - b.score; });
    return options;
  }

  // If the user has not explicitly chosen, apply the top-ranked option as a soft
  // default so Reitti/Sää/Lautat show a valid, weather-optimal plan automatically.
  function maybeAutoDefault(opts) {
    if ((!SELECTED || autoDefault) && opts && opts.length) applyOption(opts[0], true, true);
  }

  function ensureOptions(force) {
    if (optLoading) return;
    var cached = null;
    try { cached = JSON.parse(localStorage.getItem(OPT_KEY) || 'null'); } catch (e) {}
    var wxCached = null;
    try { wxCached = JSON.parse(localStorage.getItem(WX_KEY) || 'null'); } catch (e) {}

    if (cached && cached.options) {
      buildOptionsUI(cached.options, cached.ts);
      optLoaded = true;
      maybeAutoDefault(cached.options);
    } else if (wxCached && wxCached.data) {
      var opts = computeOptions(wxCached.data);
      buildOptionsUI(opts, wxCached.ts);
      optLoaded = true;
      try { localStorage.setItem(OPT_KEY, JSON.stringify({ ts: wxCached.ts, options: opts })); } catch (e) {}
      maybeAutoDefault(opts);
    }

    if (!force && optLoaded && navigator.onLine === false) return;
    if (!navigator.onLine) {
      if (!optLoaded) {
        $('#optionsList').innerHTML = '<p class="muted">Lataa sää ensin verkkoyhteyden kanssa — vaihtoehdot lasketaan ennusteesta.</p>';
      }
      return;
    }
    fetchOptionsWeather();
  }

  function fetchOptionsWeather() {
    optLoading = true;
    $('#optionsUpdated').textContent = 'Päivitetään (Ilmatieteen laitos)…';
    var spots = weatherSpots();
    if (!spots.length) {
      optLoading = false;
      $('#optionsList').innerHTML = '<p class="muted">Ei sääpisteitä määritelty.</p>';
      return;
    }
    Promise.all(spots.map(function (s) {
      return fetch(fmiUrl(s.lat, s.lon, 9))
        .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); })
        .then(function (xml) { return { name: s.name, sum: summarizeFmi(parseFmiTVP(xml)) }; })
        .catch(function (e) { console.warn('FMI options fetch failed', s.name, e); return { name: s.name, sum: null }; });
    })).then(function (results) {
      var ts = Date.now();
      var opts = computeOptions(results);
      var ok = results.some(function (r) { return r.sum; });
      if (ok) {
        try { localStorage.setItem(OPT_KEY, JSON.stringify({ ts: ts, options: opts })); } catch (e) {}
        try { localStorage.setItem(WX_KEY, JSON.stringify({ ts: ts, data: results })); } catch (e) {}
      }
      buildOptionsUI(opts, ts);
      maybeAutoDefault(opts);
      optLoaded = optLoaded || ok;
      optLoading = false;
      if (!ok) $('#optionsUpdated').textContent = 'Sään haku epäonnistui.';
    });
  }

  $('#refreshOptions').addEventListener('click', function () { ensureOptions(true); });

  /* ---------- RAIN RADAR ---------- */
  var radar = { on: false, layer: null, frames: [], idx: 0, timer: null, playing: true };
  function radarFrames(count) {
    var FIVE = 5 * 60000;
    var base = Math.floor(Date.now() / FIVE) * FIVE - FIVE;
    var arr = [];
    for (var i = count - 1; i >= 0; i--) arr.push(new Date(base - i * FIVE));
    return arr;
  }
  function radarWmsTime(d) { return d.toISOString().replace(/\.\d{3}Z$/, 'Z'); }
  function radarLabel(d, newest) {
    return new Intl.DateTimeFormat('fi-FI', { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit' }).format(d) + (newest ? ' (uusin)' : '');
  }
  function radarShow(i) {
    if (!radar.layer || !radar.frames.length) return;
    radar.idx = (i + radar.frames.length) % radar.frames.length;
    radar.layer.setParams({ time: radarWmsTime(radar.frames[radar.idx]) });
    var slider = $('#radarSlider'); if (slider) slider.value = radar.idx;
    var lbl = $('#radarTime'); if (lbl) lbl.textContent = radarLabel(radar.frames[radar.idx], radar.idx === radar.frames.length - 1);
  }
  function radarTick() {
    radarShow(radar.idx + 1);
    radar.timer = setTimeout(radarTick, radar.idx === radar.frames.length - 1 ? 2500 : 500);
  }
  function radarSetPlaying(play) {
    radar.playing = play;
    var btn = $('#radarPlay'); if (btn) btn.textContent = play ? '⏸' : '▶';
    if (radar.timer) { clearTimeout(radar.timer); radar.timer = null; }
    if (play) radarTick();
  }
  function setupRadar(map) {
    var btn = $('#radarBtn'), bar = $('#radarBar'), slider = $('#radarSlider'), play = $('#radarPlay');
    if (!btn) return;
    btn.addEventListener('click', function () {
      if (!radar.on) {
        if (!navigator.onLine) { alert('Sadetutka vaatii verkkoyhteyden.'); return; }
        radar.frames = radarFrames(16);
        slider.max = radar.frames.length - 1;
        radar.layer = L.tileLayer.wms('https://openwms.fmi.fi/geoserver/Radar/wms', {
          layers: 'Radar:suomi_rr_eureffin', format: 'image/png', transparent: true,
          opacity: 0.7, attribution: 'Sadetutka © Ilmatieteen laitos'
        }).addTo(map);
        radar.on = true; btn.classList.add('map-btn--active'); bar.classList.remove('hidden');
        radar.idx = radar.frames.length - 1; radarSetPlaying(true);
      } else {
        radar.on = false; btn.classList.remove('map-btn--active'); bar.classList.add('hidden');
        if (radar.timer) { clearTimeout(radar.timer); radar.timer = null; }
        if (radar.layer) { map.removeLayer(radar.layer); radar.layer = null; }
      }
    });
    play.addEventListener('click', function () { radarSetPlaying(!radar.playing); });
    slider.addEventListener('input', function () { radarSetPlaying(false); radarShow(+slider.value); });
  }

  /* ---------- INFO VIEW ---------- */
  function buildInfo() {
    var lod = $('#lodgingList');
    lod.innerHTML = '';
    (T.accommodations || []).forEach(function (ac) {
      var card = el('div', 'lodging-card');
      var maps = (ac.lat != null) ? ('https://www.google.com/maps?q=' + ac.lat + ',' + ac.lon)
        : ('https://www.google.com/maps/search/' + encodeURIComponent(ac.name + ' ' + (ac.address || '')));
      card.innerHTML =
        '<h3><span class="night">Yö ' + ac.night + '</span> ' + ac.name + '</h3>' +
        '<p>' + (ac.address || '') + (ac.note ? '<br>' + ac.note : '') + '</p>' +
        (ac.link ? '<a href="' + ac.link + '" target="_blank" rel="noopener">Verkkosivu ›</a> · ' : '') +
        '<a href="' + maps + '" target="_blank" rel="noopener">Karttaan ›</a>';
      lod.appendChild(card);
    });

    var notes = $('#infoNotes');
    var ul = el('ul');
    (T.infoNotes || []).forEach(function (n) { ul.appendChild(el('li', '', n)); });
    notes.innerHTML = ''; notes.appendChild(ul);

    var src = $('#sourceNotes');
    src.innerHTML = '';
    if ((T.dataGaps || []).length) {
      var gapUl = el('ul');
      T.dataGaps.forEach(function (g) { gapUl.appendChild(el('li', '', '⚠️ ' + g)); });
      src.appendChild(el('div', '', '<b>Varmista nämä ennen lähtöä:</b>'));
      src.appendChild(gapUl);
    }
    if ((T.sources || []).length) {
      var sUl = el('ul');
      T.sources.forEach(function (s) { sUl.appendChild(el('li', '', '<a href="' + s.url + '" target="_blank" rel="noopener">' + s.label + '</a>')); });
      src.appendChild(el('div', '', '<b>Lähteet:</b>'));
      src.appendChild(sUl);
    }
    $('#appMeta').textContent = 'Tiedot päivitetty ' + (T.meta && T.meta.updated ? T.meta.updated : '') + '. Aikataulut voivat muuttua — tarkista operaattorilta.';
  }

  /* ---------- Init ---------- */
  (function () {
    var dir = (T.meta && T.meta.direction) ? T.meta.direction : '';
    var sub = document.querySelector('.app-header__sub');
    if (sub && dir) sub.textContent = 'Kustavi · Brändö · Houtskär · Iniö — ' + dir.toLowerCase();
    var rt = document.getElementById('routeTitle');
    if (rt) rt.textContent = 'Reitti vaiheittain' + (dir ? ' (' + dir.toLowerCase() + ')' : '');
  })();

  buildRoute();
  buildFerryDayFilter();
  buildFerries();
  buildInfo();

  // Try to restore persisted selection (noNav=true: stay on options view)
  (function () {
    var stored = null;
    try { stored = JSON.parse(localStorage.getItem(SEL_KEY) || 'null'); } catch (e) {}
    if (stored && stored.direction && stored.d1key && stored.d2key) {
      // Build a minimal opt object with just the keys (no wx data needed for applyOption meta steps)
      applyOption({ direction: stored.direction, d1key: stored.d1key, d2key: stored.d2key }, true);
    }
  })();

  // Default view is options; initialize it now.
  if (document.getElementById('view-options').classList.contains('view--active')) {
    ensureOptions();
  }

  /* ---------- Add to Home Screen (A2HS) toast ---------- */
  (function () {
    var DISMISSED_KEY = 'skiftet_a2hs_dismissed';
    var toast = document.getElementById('a2hsToast');
    var textEl = document.getElementById('a2hsText');
    var addBtn = document.getElementById('a2hsAdd');
    var closeBtn = document.getElementById('a2hsClose');
    if (!toast) return;

    // Already running as installed standalone PWA?
    var isStandalone = (navigator.standalone === true) ||
      (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
    if (isStandalone) return;

    // Already dismissed by user?
    if (localStorage.getItem(DISMISSED_KEY)) return;

    var deferredPrompt = null;

    function showToast() {
      toast.classList.remove('hidden');
    }
    function hideToast() {
      toast.classList.add('hidden');
    }

    // Chrome/Android: capture the native install prompt
    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredPrompt = e;
      if (localStorage.getItem(DISMISSED_KEY)) return;
      setTimeout(showToast, 3500);
    });

    // After a successful install, hide the toast
    window.addEventListener('appinstalled', function () {
      hideToast();
      deferredPrompt = null;
    });

    // "Lisää" button: trigger native prompt
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function () {
          deferredPrompt = null;
          hideToast();
          localStorage.setItem(DISMISSED_KEY, '1');
        });
      });
    }

    // Dismiss "×"
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        hideToast();
        localStorage.setItem(DISMISSED_KEY, '1');
      });
    }

    // iOS Safari fallback: no beforeinstallprompt, detect manually
    var ua = navigator.userAgent || '';
    var isIOS = /iphone|ipad|ipod/i.test(ua);
    // Safari on iOS: has 'Safari' in UA but NOT 'CriOS' (Chrome iOS) or 'FxiOS' (Firefox iOS)
    var isIOSSafari = isIOS && /safari/i.test(ua) && !/crios|fxios|opios|mercury/i.test(ua);
    if (isIOSSafari) {
      // Show iOS-specific instructions; hide the "Lisää" button (can't trigger programmatically)
      if (textEl) textEl.textContent = 'Asenna: paina Jaa-painiketta ja valitse ‘Lisää Koti-valikkoon’';
      if (addBtn) addBtn.classList.add('hidden');
      setTimeout(showToast, 3500);
    }
  }());
})();
