/**
 * Saber Widget
 * Copyright 2014 Baidu Inc. All rights reserved.
 *
 * @file 图片预览控件
 * @author zfkun(zfkun@msn.com)
 */

define( function ( require, exports, module ) {

    var lang = require( 'saber-lang' );
    var dom = require( 'saber-dom' );
    var Widget = require( './Widget' );


    /**
     * CSS 专有前缀
     *
     * @const
     * @type {string}
     */
    var CSS_PREFIX = require( './lib' ).CSS_PREFIX;


    /**
     * 图片预览
     *
     * @class
     * @constructor
     * @exports ImageView
     * @extends Widget
     * @requires saber-lang
     * @requires saber-dom
     * @fires Slider#resize
     * @fires Slider#change
     * @param {Object=} options 初始化配置参数
     * @param {string=} options.id 控件标识
     * @param {HTMLElement=} options.main 控件主元素
     */
    function ImageView( options ) {

        this.attrs = {

            // /**
            //  * 背景色
            //  *
            //  * @type {string}
            //  */
            // color: { value: '#' },

            // /**
            //  * 透明度
            //  *
            //  * @type {number}
            //  */
            // opacity: { value: 0.7 },

            /**
             * 是否启用切换动画
             *
             * @type {boolean}
             */
            animate: { value: true },

            /**
             * 回弹动画时长，单位毫秒
             *
             * @type {number}
             */
            speed: { value: 400 },

            /**
             * 启动缩放的双击间隔，单位毫秒
             *
             * @type {number}
             */
            zoomAt: { value: 500 },

            /**
             * 图片附加缩放比例
             *
             * @type {Object}
             */
            zoomScale: { value: 0.8 },

            /**
             * 移动侦测阀值，单位像素
             * 当按下后`移动距离`超过此阀值时才`启动`切换动画
             *
             * @type {number}
             */
            moveAt: { value: 10 },

            /**
             * 切换阀值，单位像素
             * 当`移动距离`超过此阀值时才进行`切换`，否则进行`回弹`
             *
             * @type {number}
             */
            switchAt: { value: 30 },

            /**
             * 图片列表
             *
             * @type {Array}
             */
            items: { value: [] },

            /**
             * 初始位置
             *
             * @type {number}
             */
            index: { value: 0 },

            /**
             * 图片总数
             *
             * @type {Object}
             */
            length: {

                readOnly: true,

                getter: function () {
                    return this.get( 'items' ).length;
                }

            },

            /**
             * 包装容器元素
             *
             * @type {HTMLElement}
             */
            wrapper: {

                readOnly: true,

                getter: function () {
                    return this.runtime.wrapper;
                }

            }

        };

        /**
         * 控件状态集
         *
         * @private
         * @type {Object}
         */
        this.states = {};

        // **MUST**最后调用父类的构造函数
        // 由于子类的`attrs`、`states`等需要与父类的对应默认值进行`mixin`
        Widget.apply( this, arguments );
    }


    ImageView.prototype = {

        /**
         * 控件类型标识
         *
         * @readonly
         * @type {string}
         */
        type: 'ImageView',

        /**
         * 初始化DOM
         *
         * @override
         */
        initDom: function () {
            var runtime = this.runtime;

            // 可视窗口宽
            runtime.width = window.innerWidth;

            // 主元素
            var main = this.main = document.createElement( 'div' );
            main.className = 'ui-imageview';

            // 容器
            var wrapper = runtime.wrapper = document.createElement( 'div' );
            dom.setData( wrapper, 'role', 'wrapper' );
            wrapper.innerHTML = this.get( 'items' ).map(
                function ( item, i ) {
                    return '<div data-role="item" style="left: ' + ( i * 100 ) + '%"></div>';
                }
            ).join( '' );
            main.appendChild( wrapper );
        },

        /**
         * 初始化事件
         *
         * @override
         */
        initEvent: function () {
            // TODO: 双指缩放支持



            // 每次拖动开始时的X
            var startX;

            // 上次有效拖动的相对位移值
            var diffX = 0;

            // 上次有效拖动时计算后的X
            var x = 0;

            // 上次拖动完成后的`wrapper`元素的左外边距
            this.runtime.x = 0;

            this.addEvent( this.get( 'main' ), 'touchstart', function ( e ) {
                if ( this.is( 'disable' ) ) {
                    return;
                }

                startX = e.touches[ 0 ].pageX;
                diffX = 0;
            } );

            this.addEvent( this.get( 'main' ), 'touchmove', function ( e ) {
                if ( this.is( 'disable' ) ) {
                    return;
                }

                diffX = e.touches[ 0 ].pageX - startX;

                // 超过移动阀值，才进行移动，防止影响内部的点击
                if ( Math.abs( diffX ) > this.get( 'moveAt' ) ) {
                    e.preventDefault();

                    x = this.runtime.x + diffX;

                    this._move( x );
                }
            } );


            var lastTapTime = 0;

            this.addEvent( this.get( 'main' ), 'touchend', function ( e ) {
                if ( this.is( 'disable' ) ) {
                    return;
                }

                // 计算最近两次`tap`时差 (用于 dobule-tap 处理)
                var diffTapTime = Date.now() - lastTapTime;

                // 更新计时, 这里用加法是为了省一个临时中间变量
                lastTapTime = diffTapTime + lastTapTime;


                // 本次`tap`的X轴移动距离
                var diff = Math.abs( diffX );



                // 下面的处理，分2个部分: `拖拽` & `双击`
                // 处理优先级: `拖拽` > `双击`

                // 超过移动阀值，才进行拖动结束后的修正，防止影响内部的点击
                if ( diff > this.get( 'moveAt' ) ) {
                    // 更新存储位置
                    this.runtime.x = x;

                    // 达到切换阀值，则根据滑动方向切换
                    if ( diff > this.get( 'switchAt' ) ) {
                        this.to( this.get( 'index' ) + ( diffX < 0 ? 1 : -1 ) );
                    }
                    // 未达到阀值，则回弹复位
                    else {
                        this.to( this.get( 'index' ) );
                    }

                    return;
                }

                // 在双击延迟阀值有效范围内?
                if ( diffTapTime < this.get( 'zoomAt' ) ) {
                    // 重置计时
                    lastTapTime = 0;

                    // 启动缩放
                    this.zoom( this.get( 'index' ) );
                }

            } );
        },

        /**
         * 重新渲染视图
         * 首次渲染时, 不传入 changes 参数
         *
         * @override
         * @param {Object=} changes 变更过的属性的集合
         * 每个**属性变更对象**结构如下
         * `属性名`：[ `变更前的值`, `变更后的值` ]
         */
        repaint: function ( changes ) {
            // 先处理父类的重绘
            Widget.prototype.repaint.call( this, changes );

            // `render` 阶段调用时,不传入 `changes`
            if ( !changes ) {
                this.enable().to( this.get( 'index' ) );
            }
        },

        /**
         * 激活控件
         *
         * @override
         * @fires ImageView#enable
         * @return {ImageView} 当前实例
         */
        enable: function () {
            // 先启用插件
            if ( this.is( 'disable' ) && this.is( 'render' ) ) {
                // 遮罩插件
                require( './main' ).enablePlugin( this, 'Masker', ( this.options.plugin || {} ).masker );

                // 缩放插件
                require( './main' ).enablePlugin( this, 'Zoom', ( this.options.plugin || {} ).zoom );
            }

            // 回归父类继续后续处理
            Widget.prototype.enable.call( this );

            return this;
        },

        /**
         * 禁用控件
         *
         * @override
         * @fires ImageView#disable
         * @return {ImageView} 当前实例
         */
        disable: function () {
            if ( !this.is( 'disable' ) && this.is( 'render' ) ) {
                // 遮罩插件
                require( './main' ).disablePlugin( this, 'Masker' );

                // 缩放插件
                require( './main' ).disablePlugin( this, 'Zoom' );
            }

            // 回归父类继续后续处理
            Widget.prototype.disable.call( this );

            return this;
        },




        _load: function ( index ) {
            var node = dom.queryAll( '[data-role=item]', this.get( 'main' ) )[ index ];
            var img = node ? dom.query( 'img', node ) : null;
            if ( !img ) {
                img = document.createElement('img');

                dom.hide( img );

                img.src = this.get( 'items' )[ index ];

                var viewport = this.runtime.viewport;
                var scale = this.get( 'zoomScale' );

                img.onload = function() {
                    imageResizeToCenter( this, viewport.width, viewport.height, scale );
                    dom.show( this );
                };

                node.appendChild( img );
            }
        },

        /**
         * 切换移动
         *
         * @private
         * @param {number} x X轴偏移量
         * @param {number=} speed 移动速度,单位毫秒
         */
        _move: function ( x, speed ) {
            speed = speed || 0;
            this.get( 'wrapper' ).style.cssText += [
                ( this.get( 'animate' ) ? CSS_PREFIX + 'transition-duration:' + speed + 'ms;' : '' ),
                CSS_PREFIX + 'transform: translate(' + x + 'px, 0)',
                ' translateZ(0)',
                ';'
            ].join( '' );
        },

        _image: function ( index ) {
            return dom.queryAll( 'img', this.get( 'wrapper' ) )[ index ];
        },

        /**
         * 切换到指定项
         *
         * @public
         * @param {number} index 目标项的位置
         * @fires ImageView#change
         * @return {ImageView} 当前实例
         */
        to: function ( index ) {
            if ( this.is( 'disable' ) ) {
                return this;
            }

            var runtime = this.runtime;
            var from = this.get( 'index' );

            // 防越界
            index = Math.max( 0, Math.min( this.get( 'length' ) - 1, index ) );

            // 提前更新,以防不测- -
            this.set( 'index', index );

            // 更新计算X轴偏移
            runtime.x = 0 - runtime.width * index;

            this._move( runtime.x, this.get( 'speed' ) );

            // 排除回弹
            if ( from !== index ) {
                /**
                 * @event Slider#change
                 * @param {number} from 原来显示项的位置
                 * @param {number} to 当前显示项的位置
                 */
                this.emit( 'change', from, index );
            }

            this._load( index );

            return this;
        },

        zoom: function ( index ) {
            var zoomPlugin = this.plugin( 'Zoom' );
            if ( zoomPlugin ) {
                zoomPlugin.scale( this._image( index ) );
            }
        },

        show: function () {
            if ( this.is( 'hide' ) ) {
                this.removeState( 'hide' );
                dom.show( this.plugin( 'Masker' ).main );
                this.enable();
            }
        },

        hide: function () {
            if ( !this.is( 'hide' ) ) {
                this.disable();
                this.addState( 'hide' );
                dom.hide( this.plugin( 'Masker' ).main );
            }
        },

        // TODO
        resize: function () {
            return this;
        }

    };

    lang.inherits( ImageView, Widget );

    require( './main' ).register( ImageView );




    function imageResizeToCenter ( img, width, height, scale ) {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;

        // 先以宽为基准缩放
        if ( w > width ) {
            h *= width / w;
            w = width;
        }

        // 再以高为基准缩放
        if ( h > height ) {
            w *= height / h;
            h = height;
        }

        // 考虑美观，再稍微缩放一点，让图片四周多点间距
        w *= scale;
        h *= scale;


        dom.setStyle( img, 'width', w + 'px' );
        dom.setStyle( img, 'height', h + 'px' );


        // 高度不足, 需垂直居中（水平居中CSS已处理了）
        if ( h < height ) {
            var marginTop = Math.round( Math.max( ( height - h ) / 2, 0 ) );
            dom.setStyle( img, 'margin-top', marginTop + 'px' );
        }
    }



    return ImageView;

} );
