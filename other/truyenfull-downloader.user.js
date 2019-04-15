// ==UserScript==
// @name         TruyenFull downloader
// @namespace    https://vfa-vinhtt.github.io/
// @description  Tải truyện từ truyenfull.vn định dạng epub
// @version      1.0.0
// @icon         
// @author       vinhtt
// @oujs:author  vinhtt
// @license      MIT
// @include      https://truyenfull.vn/*
// @exclude      https://truyenfull.vn/
// @exclude      https://truyenfull.vn/*/chuong-*
// @exclude      https://truyenfull.vn/danh-sach/*
// @exclude      https://truyenfull.vn/the-loai/*
// @exclude      https://truyenfull.vn/tac-gia/*
// @exclude      https://truyenfull.vn/contact/
// @exclude      https://truyenfull.vn/tos/
// @exclude      https://truyenfull.vn/sitemap.xml
// @require      https://code.jquery.com/jquery-3.3.1.min.js
// @require      https://unpkg.com/jepub@1.2.5/dist/jepub.min.js
// @require      https://unpkg.com/file-saver@2.0.1/dist/FileSaver.min.js
// @noframes
// @connect      self
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function ($, window, document) {
    'use strict';

    /**
     * Nhận cảnh báo khi có chương bị lỗi
     */
    var errorAlert = true;

    /**
     * Thời gian giãn cách giữa 2 lần tải
     * @type {Number}
     */
    var downloadDelay = 0;


    function cleanHtml(str) {
        str = str.replace(/\s*Chương\s*\d+\s?:[^<\n]/, '');
        str = str.replace(/[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD\u10000-\u10FFFF]+/gm, ''); // eslint-disable-line
        return '<div>' + str + '</div>';
    }

    function downloadError(mess, err, server) {
        downloadStatus('danger');
        if (errorAlert) errorAlert = confirm('Lỗi! ' + mess + '\nBạn có muốn tiếp tục nhận cảnh báo?');
        if (err) console.error(mess);

        if (server) {
            if (downloadDelay > 700) {
                titleError.push(chapTitle);
                saveEbook();
                return;
            }

            downloadStatus('warning');
            downloadDelay += 100;
            setTimeout(function () {
                getContent();
            }, downloadDelay);
            return;
        }
        titleError.push(chapTitle);

        return '<p class="no-indent"><a href="' + referrer + chapId + '">' + mess + '</a></p>';
    }

    function saveEbook() {
        if (endDownload) return;
        endDownload = true;
        $download.html('Đang nén EPUB');

        if (titleError.length) {
            titleError = '<p class="no-indent"><strong>Các chương lỗi: </strong>' + titleError.join(', ') + '</p>';
        } else {
            titleError = '';
        }
        beginEnd = '<p class="no-indent">Nội dung từ <strong>' + begin + '</strong> đến <strong>' + end + '</strong></p>';

        jepub.notes(beginEnd + titleError + '<br /><br />' + credits);

        jepub.generate().then(function (epubZipContent) {
            document.title = '[⇓] ' + ebookTitle;
            $win.off('beforeunload');

            $download.attr({
                href: window.URL.createObjectURL(epubZipContent),
                download: ebookFilename
            }).text('Hoàn thành').off('click');
            if (status !== 'danger') downloadStatus('success');

            saveAs(epubZipContent, ebookFilename);
        }).catch(function (err) {
            downloadStatus('danger');
            console.error(err);
        });
    }

    function getContent() {
        if (endDownload) return;
        chapId = chapList[count];

        $.get(pathname + chapId + '/').done(function (response) {
            var $data = $(response),
                $chapter = $data.find('.chapter-c'),
                $notContent = $chapter.find('script, style, a'),
                $referrer = $chapter.find('[style]').filter(function () {
                    return (this.style.fontSize === '1px' || this.style.fontSize === '0px' || this.style.color === 'white');
                }),
                chapContent;

            if (endDownload) return;

            chapTitle = $data.find('.chapter-title').text().trim();
            if (chapTitle === '') chapTitle = 'Chương ' + chapId.match(/\d+/)[0];

            if (!$chapter.length) {
                chapContent = downloadError('Không có nội dung');
            } else {
                var $img = $chapter.find('img');
                if ($img.length) $img.replaceWith(function () {
                    return '<br /><a href="' + this.src + '">Click để xem ảnh</a><br />';
                });

                if ($notContent.length) $notContent.remove();
                if ($referrer.length) $referrer.remove();

                if ($chapter.text().trim() === '') {
                    chapContent = downloadError('Nội dung không có');
                } else {
                    if (status !== 'danger') downloadStatus('warning');
                    chapContent = cleanHtml($chapter.html());
                }
            }

            jepub.add(chapTitle, chapContent);

            if (count === 0) begin = chapTitle;
            end = chapTitle;

            $download.html('Đang tải: ' + Math.floor((count / chapListSize) * 100) + '%');

            count++;
            document.title = '[' + count + '] ' + pageName;
            if (count >= chapListSize) {
                saveEbook();
            } else {
                setTimeout(function () {
                    getContent();
                }, downloadDelay);
            }
        }).fail(function (err) {
            downloadError('Kết nối không ổn định', err, true);
        });
    }


    var pageName = document.title,
        $win = $(window),

        $download = $('<a>', {
            class: 'btn btn-primary',
            href: '#download',
            text: 'Tải xuống'
        }),
        status,
        downloadStatus = function (label) {
            status = label;
            $download.removeClass('btn-primary btn-success btn-info btn-warning btn-danger').addClass('btn-' + status);
        },

        $novelId = $('#truyen-id'),
        chapList = [],
        chapListSize = 0,
        chapId = '',
        chapTitle = '',
        count = 0,
        begin = '',
        end = '',
        endDownload = false,

        ebookTitle = $('h1').text().trim(),
        ebookAuthor = $('.info a[itemprop="author"]').text().trim(),
        // ebookCover = $('.books img').attr('src'),
        ebookDesc = $('.desc-text').html(),
        ebookType = [],
        beginEnd = '',
        titleError = [],

        host = location.host,
        pathname = location.pathname,
        referrer = location.protocol + '//' + host + pathname,

        ebookFilename = pathname.slice(1, -1) + '.epub',

        credits = '<p>Truyện được tải từ <a href="' + referrer + '">TruyenFull</a></p><p>Userscript được viết bởi: <a href="https://lelinhtinh.github.io/jEpub/">Zzbaivong</a></p>',

        jepub;


    if (!$novelId.length) return;

    var $ebookType = $('.info a[itemprop="genre"]');
    if ($ebookType.length)
        $ebookType.each(function () {
            ebookType.push($(this).text().trim());
        });

    jepub = new jEpub({
        title: ebookTitle,
        author: ebookAuthor,
        publisher: host,
        description: ebookDesc,
        tags: ebookType
    }).uuid(referrer);

    $download.insertAfter('.info');
    $download.wrap('<div class="panel-group books"></div>');
    $download.one('click contextmenu', function (e) {
        e.preventDefault();
        document.title = '[...] Vui lòng chờ trong giây lát';

        $.when($.get('/ajax.php', {
            type: 'hash'
        })).done(function (res) {
            $.get('/ajax.php', {
                type: 'chapter_option',
                data: $novelId.val(),
                bnum: '',
                num: 1,
                hash: res
            }).done(function (data) {
                chapList = data.match(/(?:value=")[^"]+(?=")/g).map(function (val) {
                    return val.slice(7);
                });

                if (e.type === 'contextmenu') {
                    $download.off('click');
                    var startFrom = prompt('Nhập ID chương truyện bắt đầu tải:', chapList[0]);
                    startFrom = chapList.indexOf(startFrom);
                    if (startFrom !== -1) chapList = chapList.slice(startFrom);
                } else {
                    $download.off('contextmenu');
                }

                chapListSize = chapList.length;
                if (chapListSize > 0) {
                    $win.on('beforeunload', function () {
                        return 'Truyện đang được tải xuống...';
                    });

                    $download.one('click', function (e) {
                        e.preventDefault();
                        saveEbook();
                    });

                    getContent();
                }
            }).fail(function (jqXHR, textStatus) {
                downloadError(textStatus);
            });
        }).fail(function (jqXHR) {
            $download.text('Lỗi danh mục');
            downloadStatus('danger');
            console.error(jqXHR);
        });
    });

})(jQuery, window, document);
