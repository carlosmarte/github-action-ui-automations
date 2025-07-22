.PHONY: install run

install:
	mkdir -p dataset
	npm install --prefix run_accessibility
	npm install --prefix run_build_locator_object
	npm install --prefix run_collect_html_structure
	npm install --prefix run_collect_loaded_resources
	npm install --prefix run_console_listener
	npm install --prefix run_cookies
	npm install --prefix run_disabled_javascript
	npm install --prefix run_extract_interactivity
	npm install --prefix run_html_tree_metadata
	npm install --prefix run_lighthouse
	npm install --prefix run_links
	npm install --prefix run_seo
	npm install --prefix run_video_recording

run:
	node run_accessibility/accessibility.mjs
	node run_build_locator_object/build_locator_object.mjs
	node run_collect_html_structure/html-structure-collector.mjs
	node run_collect_loaded_resources/loaded-resources-collector.mjs
	node run_console_listener/console-listener.mjs
	node run_cookies/cookies.mjs
	node run_disabled_javascript/disabled-javascript-tester.mjs
	node run_extract_interactivity/run_extract_interactivity.mjs
	node run_html_tree_metadata/html-tree-metadata.mjs
	node run_lighthouse/lighthouse.mjs
	node run_links/links.mjs
	node run_seo/seo-analyzer.mjs
	node run_video_recording/video-recorder.mjs