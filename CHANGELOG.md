# Changelog

## [0.4.0](https://github.com/alexmyt/ai-for-developers-project-386/compare/v0.3.0...v0.4.0) (2026-11-14)


### Features

* **web:** format day heading in russian ([f1acf8f](https://github.com/alexmyt/ai-for-developers-project-386/commit/f1acf8f3f75a1efabb76fc55cc26b5d59dfcb91c))
* **web:** show msk timezone on time labels ([f91b2cc](https://github.com/alexmyt/ai-for-developers-project-386/commit/f91b2ccab874801fdf0e339d3737c62f4b55e815))


### Bug Fixes

* **web:** mark overlapping slots taken after booking ([ff34fb8](https://github.com/alexmyt/ai-for-developers-project-386/commit/ff34fb8229e766157a49fcd0bee1449594adc8a4))

## [0.3.0](https://github.com/alexmyt/ai-for-developers-project-386/compare/v0.2.0...v0.3.0) (2026-11-14)


### Features

* **deploy:** add render blueprint ([03ebe69](https://github.com/alexmyt/ai-for-developers-project-386/commit/03ebe69288a6f396f8afcb10d9f962c7e4cc6fd4))


### Bug Fixes

* **deploy:** authenticate render mcp with an api key ([b37c09d](https://github.com/alexmyt/ai-for-developers-project-386/commit/b37c09dd2a3558fc2909b8f915e4d23588993d1a))
* **deploy:** bridge render mcp through mcp-remote ([6a36556](https://github.com/alexmyt/ai-for-developers-project-386/commit/6a36556a158664585a88bbbd4ca1e12eb0d4320a))
* **docker:** honor PORT in healthcheck and container e2e ([a4e38e2](https://github.com/alexmyt/ai-for-developers-project-386/commit/a4e38e2f894072de14e7b60150568b0ded925dd8))

## [0.2.0](https://github.com/alexmyt/ai-for-developers-project-386/compare/v0.1.0...v0.2.0) (2026-11-12)


### Features

* **api:** create booking inside per-date mutex ([9b4154a](https://github.com/alexmyt/ai-for-developers-project-386/commit/9b4154a5364261dfe8616d31d223cbb57d16fa16))
* **api:** create meeting type with field validation and id conflict ([c28d843](https://github.com/alexmyt/ai-for-developers-project-386/commit/c28d8433aa17f65f3372c0825ad7a5bf0c047d6b))
* **api:** serve 14-day availability grid from in-memory state ([aed923f](https://github.com/alexmyt/ai-for-developers-project-386/commit/aed923f7e5f171cd9e498b7e7ceb3335f51ccf4e))
* **api:** serve built web static with spa fallback ([80728ea](https://github.com/alexmyt/ai-for-developers-project-386/commit/80728ea8b8bb7e76e6a06a2b821c80ad056019a8))
* **api:** serve meeting types from in-memory store ([a1fd6e2](https://github.com/alexmyt/ai-for-developers-project-386/commit/a1fd6e2bb20bba71ece519d88f9bc261f575c014))
* **api:** serve upcoming bookings list to owner ([4865049](https://github.com/alexmyt/ai-for-developers-project-386/commit/48650490a69e9508d2fd21ef99b71f4f14d39743))
* **api:** validate booking window, grid and interval overlap ([250c569](https://github.com/alexmyt/ai-for-developers-project-386/commit/250c569818d5964c863dfd065e7dfd8f1cf62034))
* **contract:** add availability operation with typed errors ([7c1b39a](https://github.com/alexmyt/ai-for-developers-project-386/commit/7c1b39ae495df83cae63fb58a440acdd50c22ae2))
* **contract:** add create booking operation with typed errors ([ce47d05](https://github.com/alexmyt/ai-for-developers-project-386/commit/ce47d0592121fc4880cf8c8e28fedd4d1b8bd0fc))
* **contract:** add create meeting type operation ([768d587](https://github.com/alexmyt/ai-for-developers-project-386/commit/768d5873e106248d3f3541dfb09d62831009fa9b))
* **contract:** add list bookings operation for owner ([5f7854a](https://github.com/alexmyt/ai-for-developers-project-386/commit/5f7854a5c5487f269945f39f7566252c28cf7ad1))
* **contract:** describe meeting type and generate sdk client ([e9b757c](https://github.com/alexmyt/ai-for-developers-project-386/commit/e9b757cb921e53c9554b373433a2a7ee65d86bd4))
* **tooling:** run all checks with one command ([2208f42](https://github.com/alexmyt/ai-for-developers-project-386/commit/2208f42e50a351a04ab877217fc4acd2fa8e7f2c)), closes [#27](https://github.com/alexmyt/ai-for-developers-project-386/issues/27)
* **web:** add continue step between slot choice and guest form ([070b84c](https://github.com/alexmyt/ai-for-developers-project-386/commit/070b84c478cb0826c7132f480fe18ee85ff74276))
* **web:** add guest entry page and booking stub ([f3165c9](https://github.com/alexmyt/ai-for-developers-project-386/commit/f3165c9ab6b9a58e096ed60b84d00ed2afbd9905))
* **web:** add owner admin screen for creating meeting types ([59b490a](https://github.com/alexmyt/ai-for-developers-project-386/commit/59b490ab1aa891c5a3b1b8e46079cd6f5510557c))
* **web:** let guest book a free slot with name and email ([8a23200](https://github.com/alexmyt/ai-for-developers-project-386/commit/8a232008d871b22b52b74491d5bc8ad4d4cf18cc))
* **web:** return guest to slot choice on slot_taken conflict ([0327b81](https://github.com/alexmyt/ai-for-developers-project-386/commit/0327b810a22f7be50dcb5c94a00e6946b933d9b8))
* **web:** show 14-day calendar with slot statuses on book page ([9d4eb81](https://github.com/alexmyt/ai-for-developers-project-386/commit/9d4eb8191937a5a18b3340a323cda7e317978d29))
* **web:** show meeting types fetched via generated sdk ([85e9817](https://github.com/alexmyt/ai-for-developers-project-386/commit/85e98171e0911277da32ad694a01af1e96d82e0a))
* **web:** show upcoming bookings on owner page ([e9d4766](https://github.com/alexmyt/ai-for-developers-project-386/commit/e9d476620c54aedfedf077bd2f26bc578527b7d8))
* **web:** главная страница ([a5df095](https://github.com/alexmyt/ai-for-developers-project-386/commit/a5df0957658f3c51935b94103640a918830452a3))


### Bug Fixes

* **opencode:** correct model name casing ([22da30e](https://github.com/alexmyt/ai-for-developers-project-386/commit/22da30e91b7f6831aeba736d9732c97138ec8499))
