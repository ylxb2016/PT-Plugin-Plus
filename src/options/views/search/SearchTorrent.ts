import Vue from "vue";
import Extension from "@/service/extension";
import { Route } from "vue-router";
import {
  EAction,
  Site,
  SiteSchema,
  Dictionary,
  EDownloadClientType,
  DataResult,
  EPaginationKey,
  EModule,
  LogItem,
  SearchResultItem,
  SearchResultItemTag,
  SearchSolution,
  Options,
  SearchSolutionRange,
  SearchEntry,
  DownloadClient,
  DownloadOptions,
  ECommonKey,
  ERequestMethod
} from "@/interface/common";
import { filters } from "@/service/filters";
import dayjs from "dayjs";
import { Downloader, downloadFile, FileDownloader } from "@/service/downloader";
import * as basicContext from "basiccontext";
import { PathHandler } from "@/service/pathHandler";
import MovieInfoCard from "@/options/components/MovieInfoCard.vue";

type searchResult = {
  sites: Dictionary<any>;
  tags: Dictionary<any>;
  categories: Dictionary<any>;
  failedSites: any[];
  noResultsSites: any[];
};

const extension = new Extension();

export default Vue.extend({
  components: {
    MovieInfoCard
  },
  data() {
    return {
      words: {
        title: "搜索结果",
        download: "下载",
        downloadFailed: "重下失败",
        sendToClient: "服务器下载",
        sendToClientTip: "发送到下载服务器",
        save: "下载种子文件到本地",
        searching: "正在搜索中，请稍候……",
        cancelSearch: "取消搜索",
        showCheckbox: "多选",
        noTag: "无标签",
        allSites: "全部站点",
        multiDownloadConfirm:
          "当前下载的种子数量超过一个，浏览器可能会多次提示保存，是否继续？",
        copyToClipboard: "复制链接",
        copyToClipboardTip: "复制下载链接到剪切板",
        reSearch: "重新再搜索",
        showCategory: "分类",
        filterSearchResults: "过滤搜索结果",
        noResultsSites: "无结果站点：",
        failedSites: "失败站点：",
        reSearchFailedSites: "重试失败的站点"
      },
      key: "",
      // 指定站点搜索
      host: "",
      options: this.$store.state.options as Options,
      getters: this.$store.getters,
      searchMsg: "",
      datas: [] as any,
      getLinks: [] as any,
      selected: [],
      pagination: {
        page: 1,
        rowsPerPage: 100
      },
      loading: false,
      headers: [
        {
          text: "站点",
          align: "center",
          value: this.$store.state.options.searchResultOrderBySitePriority
            ? "site.priority"
            : "site.host",
          width: "100px"
        },
        { text: "标题", align: "left", value: "title" },
        {
          text: "分类/入口",
          align: "center",
          value: "category.name",
          width: "150px"
        },
        { text: "大小", align: "right", value: "size", width: "100px" },
        // { text: "评论", align: "center", value: "comments" },
        { text: "上传", align: "right", value: "seeders", width: "60px" },
        { text: "下载", align: "right", value: "leechers", width: "60px" },
        { text: "完成", align: "right", value: "completed", width: "60px" },
        // { text: "发布者", align: "left", value: "author" },
        { text: "发布于(≈)", align: "left", value: "time", width: "130px" },
        { text: "操作", sortable: false, width: "100px" }
      ],
      errorMsg: "",
      haveError: false,
      haveSuccess: false,
      successMsg: "",
      currentSite: {} as Site,
      skipSites: "",
      beginTime: null as any,
      reloadCount: 0,
      searchQueue: [] as any[],
      searchTimer: 0,
      // 搜索结果
      searchResult: {
        sites: {},
        tags: {},
        categories: {},
        failedSites: [],
        noResultsSites: []
      } as searchResult,
      checkBox: false,
      // 正在下载的种子文件进度信息
      downloading: {
        count: 0,
        completed: 0,
        speed: 0,
        progress: 0
      },
      latestTorrentsKey: "__LatestTorrents__",
      latestTorrentsOnly: false,
      searchSiteCount: 0,
      sending: {
        count: 0,
        completed: 0,
        speed: 0,
        progress: 0
      },
      showCategory: false,
      fixedTable: false,
      siteContentMenus: {} as any,
      clientContentMenus: [] as any,
      filterKey: "",
      showFailedSites: false,
      showNoResultsSites: false,
      pathHandler: new PathHandler(),
      IMDbId: "",
      // 下载失败的种子列表
      downloadFailedTorrents: [] as FileDownloader[]
    };
  },
  created() {
    if (!this.options.system) {
      this.writeLog({
        event: `SearchTorrent.init`,
        msg: "系统参数丢失"
      });
    }
    this.pagination = this.$store.getters.pagination(
      EPaginationKey.searchTorrent,
      {
        rowsPerPage: 100
      }
    );
  },
  beforeRouteUpdate(to: Route, from: Route, next: any) {
    if (!to.params.key) {
      return;
    }
    this.key = to.params.key;
    this.host = to.params.host;
    // this.$route.params
    next();
  },
  /**
   * 当前组件激活时触发
   * 因为启用了搜索结果缓存，所以需要在这里处理关键字
   */
  activated() {
    if (this.$route.params["key"]) {
      this.key = this.$route.params["key"];
    }

    this.host = this.$route.params["host"];
  },
  watch: {
    key() {
      this.doSearch();
    },
    host() {
      this.doSearch();
    },
    successMsg() {
      this.haveSuccess = this.successMsg != "";
    },
    errorMsg() {
      this.haveError = this.errorMsg != "";
    },
    "$store.state.options.defaultSearchSolutionId"() {
      this.doSearch();
      // console.log(this.options.defaultSearchSolutionId);
    },
    loading() {
      this.$store.commit("updateSearchStatus", this.loading);
    }
  },
  methods: {
    /**
     * 记录日志
     * @param options
     */
    writeLog(options: LogItem) {
      extension.sendRequest(EAction.writeLog, null, {
        module: EModule.options,
        event: options.event,
        msg: options.msg,
        data: options.data
      });
    },
    /**
     * 延迟执行搜索
     */
    doSearch() {
      clearTimeout(this.searchTimer);
      this.searchTimer = setTimeout(() => {
        this.search();
      }, 220);
    },
    /**
     * 开始搜索
     */
    search() {
      this.selected = [];
      this.clearMessage();
      this.datas = [];
      this.getLinks = [];
      this.searchResult = {
        sites: {},
        tags: {},
        categories: {},
        failedSites: [],
        noResultsSites: []
      } as searchResult;
      this.filterKey = "";

      if (window.location.hostname == "localhost") {
        $.getJSON("http://localhost:8001/testSearchData.json").done(
          (result: any) => {
            if (result) {
              this.addSearchResult(result);
              // this.datas = result;
            }
            // console.log(result);
          }
        );
        return;
      }

      if (this.loading || !this.key) return;

      if (!this.options.system) {
        if (this.reloadCount >= 10) {
          this.errorMsg =
            "系统参数丢失，多次尝试等待后无效，请重新打开配置页再试";
          this.writeLog({
            event: `SearchTorrent.init`,
            msg: this.errorMsg
          });
          return;
        }
        setTimeout(() => {
          this.search();
        }, 200);
        this.reloadCount++;
        return;
      }

      if (!this.options.sites) {
        this.errorMsg = "请先设置站点";
        return;
      }

      let searchKeys = {
        id: "",
        cn: "",
        en: ""
      };

      // 当搜索关键字包含|时表示指定了多个内容，格式如下
      // doubanid|中文名|英文名
      // imdbid|中文名|英文名
      if (this.key.indexOf("|")) {
        let tmp = (this.key + "||").split("|");
        searchKeys.id = tmp[0];
        searchKeys.cn = tmp[1];
        searchKeys.en = tmp[2];
      }

      // 豆瓣ID
      if (/(douban\d+)/.test(this.key)) {
        this.getIMDbIdFromDouban(this.key)
          .then(result => {
            if (typeof result == "string") {
              this.key = result;
              this.search();
            } else {
              if (searchKeys.cn) {
                this.key = searchKeys.cn;
                this.search();
              } else {
                this.errorMsg = "豆瓣ID转换失败";
                this.searchMsg = this.errorMsg;
                this.loading = false;
              }
            }
          })
          .catch(error => {
            this.errorMsg = error;
          });
        return;
      }

      let sites: Site[] = [];
      let skipSites: string[] = [];
      this.skipSites = "";

      if (this.key === this.latestTorrentsKey) {
        this.latestTorrentsOnly = true;
      } else {
        this.latestTorrentsOnly = false;
      }

      this.options = this.$store.state.options;
      let searchSolutionId = this.options.defaultSearchSolutionId;

      // 指定搜索方案id
      if (/^[a-z0-9]{32}$/.test(this.host)) {
        searchSolutionId = this.host;
        this.host = "";
      }

      // 是否指定了站点
      if (this.host) {
        let site = this.options.sites.find((item: Site) => {
          return item.host === this.host;
        });
        if (site) {
          sites.push(this.clone(site));
        }
      } else if (
        // 指定了搜索方案
        searchSolutionId &&
        this.options.searchSolutions &&
        searchSolutionId != "all"
      ) {
        let _sites: Site[] = [];
        this.options.sites.forEach((item: Site) => {
          _sites.push(this.clone(item));
        });

        let searchSolution:
          | SearchSolution
          | undefined = this.options.searchSolutions.find(
          (solution: SearchSolution) => {
            return solution.id === searchSolutionId;
          }
        );

        if (searchSolution) {
          searchSolution.range.forEach((range: SearchSolutionRange) => {
            let index = _sites.findIndex((item: any) => {
              return item.host === range.host;
            });

            if (index > -1) {
              let site: any = _sites[index];
              let siteEntry: SearchEntry[] = site.searchEntry;
              if (siteEntry) {
                siteEntry.forEach((v, index) => {
                  siteEntry[index].enabled = false;
                });
                range.entry &&
                  range.entry.forEach((key: string) => {
                    let index: number = siteEntry.findIndex(
                      (entry: SearchEntry) => {
                        return entry.id == key || entry.name == key;
                      }
                    );
                    if (siteEntry[index] && siteEntry[index].name) {
                      siteEntry[index].enabled = true;
                    }
                  });
              }

              sites.push(site);
            }
          });
        }
      } else {
        this.options.sites.forEach((item: Site) => {
          if (
            item.allowSearch ||
            this.options.defaultSearchSolutionId == "all"
          ) {
            let siteSchema: SiteSchema = this.getSiteSchema(item);
            if (
              siteSchema &&
              siteSchema.searchEntry &&
              siteSchema.searchEntry.length > 0
            ) {
              sites.push(this.clone(item));
            } else if (item.searchEntry && item.searchEntry.length > 0) {
              sites.push(this.clone(item));
            } else {
              skipSites.push(item.name);
            }
          }
        });
      }

      if (skipSites.length > 0) {
        this.skipSites = " 暂不支持搜索的站点：" + skipSites.join(",");
      }

      if (sites.length === 0) {
        this.errorMsg =
          "您还没有配置允许搜索的站点，请先前往【站点设置】进行配置";
        return;
      }

      this.searchSiteCount = sites.length;
      this.beginTime = dayjs();
      this.writeLog({
        event: `SearchTorrent.Search.Start`,
        msg: `准备开始搜索，共需搜索 ${sites.length} 个站点`,
        data: {
          key: this.key
        }
      });

      this.pagination.page = 1;
      this.doSearchTorrentWithQueue(sites);
      if (/^(tt\d+)$/.test(this.key)) {
        this.IMDbId = this.key;
      } else {
        this.IMDbId = "";
      }
    },

    /**
     * 执行搜索队列
     */
    doSearchTorrentWithQueue(sites: Site[]) {
      this.loading = true;
      this.searchMsg = "正在搜索……";
      sites.forEach((site: Site, index: number) => {
        this.searchQueue.push({
          site,
          key: this.key
        });

        this.writeLog({
          event: `SearchTorrent.Search.Processing`,
          msg: "正在搜索 [" + site.name + "]",
          data: {
            host: site.host,
            name: site.name,
            key: this.key
          }
        });

        this.sendSearchRequest(site);
      });
    },

    /**
     * 发送搜索请求
     * @param site
     */
    sendSearchRequest(site: Site) {
      extension
        .sendRequest(EAction.getSearchResult, null, {
          key: this.latestTorrentsOnly ? "" : this.key,
          site: site
        })
        .then((result: any) => {
          if (result && result.length) {
            this.writeLog({
              event: `SearchTorrent.Search.Done[${site.name}]`,
              msg: `[${site.name}] 搜索完成，共有 ${result.length} 条结果`,
              data: {
                host: site.host,
                name: site.name,
                key: this.key
              }
            });
            this.addSearchResult(result);
            return;
          } else if (result && result.msg) {
            this.writeLog({
              event: `SearchTorrent.Search.Error1`,
              msg: result.msg,
              data: {
                host: site.host,
                name: site.name,
                key: this.key
              }
            });
            this.errorMsg = result.msg;
          } else {
            if (result && result.statusText == "abort") {
              this.errorMsg = `${site.host} 搜索请求已取消`;
            } else {
              if (result && result.statusText == "timeout") {
                this.errorMsg = `${site.host} 连接超时`;
              } else {
                this.errorMsg = `${site.host} 发生网络或其他错误`;
              }

              this.writeLog({
                event: `SearchTorrent.Search.Error2`,
                msg: this.errorMsg,
                data: {
                  host: site.host,
                  name: site.name,
                  key: this.key,
                  result
                }
              });
            }
          }
          this.searchResult.failedSites.push({
            site: site,
            msg: this.errorMsg,
            color: "orange darken-1"
          });
        })
        .catch((result: DataResult) => {
          console.log(result);
          if (result.msg) {
            this.errorMsg = result.msg;
          }
          this.writeLog({
            event: `SearchTorrent.Search.Error3`,
            msg: result.msg,
            data: result
          });

          if (result.data && result.data.isLogged == false) {
            this.searchResult.failedSites.push({
              site: site,
              url: site.url,
              msg: "未登录",
              color: "grey"
            });
          } else {
            this.searchResult.noResultsSites.push({
              site: site,
              msg: this.errorMsg,
              color: "light-blue darken-2"
            });
          }
        })
        .finally(() => {
          this.removeQueue(site);
        });
    },

    /**
     * 取消一个搜索队列
     */
    abortSearch(site: Site) {
      extension
        .sendRequest(EAction.abortSearch, null, {
          key: this.key,
          site: site
        })
        .then(() => {
          this.writeLog({
            event: `SearchTorrent.Search.Abort`,
            msg: `${site.name} 搜索已取消`
          });
        })
        .catch(() => {
          this.writeLog({
            event: `SearchTorrent.Search.Abort.Error`,
            msg: `${site.name} 搜索取消失败`
          });
          this.removeQueue(site);
        });
    },

    /**
     * 移除搜索队列
     */
    removeQueue(site: Site) {
      let index = this.searchQueue.findIndex((item: any) => {
        return item.site.host === site.host;
      });
      if (index !== -1) {
        this.searchQueue.splice(index, 1);
        if (this.searchQueue.length == 0) {
          this.searchMsg = `搜索完成，共找到 ${
            this.datas.length
          } 条结果，耗时：${dayjs().diff(this.beginTime, "second", true)} 秒。`;
          this.loading = false;
          this.writeLog({
            event: `SearchTorrent.Search.Finished`,
            msg: this.searchMsg,
            data: {
              key: this.key
            }
          });
        }
      }
    },
    /**
     * 添加搜索结果，并组织字段格式
     */
    addSearchResult(result: any[]) {
      let allSites = this.words.allSites;

      if (!this.searchResult.sites[allSites]) {
        this.searchResult.sites[allSites] = [];
      }

      result.forEach((item: SearchResultItem) => {
        // 忽略重复的搜索结果
        if (this.getLinks.indexOf(item.link) !== -1) {
          // 跳过本次循环进行下一个元素
          return;
        }

        if (dayjs(item.time).isValid()) {
          // 转成整数是为了排序
          item.time = dayjs(item.time).valueOf();
        } else if (typeof item.time == "string") {
          let time = filters.timeAgoToNumber(item.time);
          if (time > 0) {
            item.time = time;
          }
        }

        if (!item.titleHTML) {
          item.titleHTML = item.title;
        }
        item.title = $("<span/>")
          .html(item.titleHTML)
          .text()
          .trim();
        if (item.size) {
          item.size = this.fileSizetoLength(item.size as string);
        }

        if (item.seeders && typeof item.seeders == "string") {
          item.seeders = parseInt((item.seeders as string).replace(",", ""));
          if (isNaN(item.seeders)) {
            item.seeders = 0;
          }
        }

        if (item.leechers && typeof item.leechers == "string") {
          item.leechers = parseInt((item.leechers as string).replace(",", ""));
          if (isNaN(item.leechers)) {
            item.leechers = 0;
          }
        }

        if (item.completed && typeof item.completed == "string") {
          item.completed = parseInt(
            (item.completed as string).replace(",", "")
          );
          if (isNaN(item.completed)) {
            item.completed = 0;
          }
        }

        // 将 // 替换为 /
        item.link = (item.link as string)
          .replace("://", "****")
          .replace(/\/\//g, "/")
          .replace("****", "://");

        item.url = (item.url as string)
          .replace("://", "****")
          .replace(/\/\//g, "/")
          .replace("****", "://");

        this.datas.push(item);
        this.getLinks.push(item.link);

        this.searchMsg = `已接收 ${this.datas.length} 条结果，搜索仍在进行……`;

        let siteName = item.site.name;
        if (!this.searchResult.sites[siteName]) {
          this.searchResult.sites[siteName] = [];
        }
        this.searchResult.sites[siteName].push(item);
        this.addTagResult(item);
        this.addCategoryResult(item);
      });

      this.searchResult.sites[allSites] = this.datas;
    },

    /**
     * 添加搜索结果标签
     * @param item
     */
    addTagResult(item: SearchResultItem) {
      let noTag = this.words.noTag;

      if (!this.searchResult.tags[noTag]) {
        this.searchResult.tags[noTag] = {
          tag: {
            name: noTag,
            color: "blue-grey darken-2"
          },
          items: []
        };
      }

      if (item.tags == undefined || item.tags == null || !item.tags.length) {
        this.searchResult.tags[noTag].items.push(item);
        return;
      }

      item.tags.forEach((tag: SearchResultItemTag) => {
        let name = tag.name as string;
        if (!name) return;
        if (!this.searchResult.tags[name]) {
          this.searchResult.tags[name] = {
            tag,
            items: []
          };
        }
        this.searchResult.tags[name].items.push(item);
      });
    },

    /**
     * 添加搜索结果分类
     * @param item
     */
    addCategoryResult(item: SearchResultItem) {
      if (!item.category) {
        return;
      }

      let name = "";
      if (typeof item.category == "string") {
        name = item.category;
        item.category = {
          name: name
        };
      } else {
        name = item.category.name as string;
      }

      if (!name) return;

      if (!this.searchResult.categories[name]) {
        this.searchResult.categories[name] = {
          name,
          items: []
        };
      }
      this.searchResult.categories[name].items.push(item);
    },
    /**
     * @return {number}
     */
    fileSizetoLength(size: string | number): number {
      if (typeof size == "number") {
        return size;
      }
      let _size_raw_match = size.match(
        /^(\d*\.?\d+)(.*[^TGMK])?([TGMK](B|iB))$/i
      );
      if (_size_raw_match) {
        let _size_num = parseFloat(_size_raw_match[1]);
        let _size_type = _size_raw_match[3];
        switch (true) {
          case /Ti?B/i.test(_size_type):
            return _size_num * Math.pow(2, 40);
          case /Gi?B/i.test(_size_type):
            return _size_num * Math.pow(2, 30);
          case /Mi?B/i.test(_size_type):
            return _size_num * Math.pow(2, 20);
          case /Ki?B/i.test(_size_type):
            return _size_num * Math.pow(2, 10);
          default:
            return _size_num;
        }
      }
      return 0;
    },

    /**
     * 根据指定的站点获取站点的架构信息
     * @param site 站点信息
     */
    getSiteSchema(site: Site): SiteSchema {
      let schema: SiteSchema = {};
      if (typeof site.schema === "string") {
        schema =
          this.options.system &&
          this.options.system.schemas &&
          this.options.system.schemas.find((item: SiteSchema) => {
            return item.name == site.schema;
          });
      }

      return schema;
    },
    /**
     * 发送下载链接到服务器
     * @param url
     * @param title
     */
    sendToClient(
      url: string,
      title?: string,
      options?: any,
      callback?: any,
      link: string = ""
    ) {
      console.log(url);
      this.clearMessage();
      let host = filters.parseURL(url).host;
      let site = this.options.sites.find((site: Site) => {
        return site.host === host;
      });
      let defaultClientOptions: any = {};
      let defaultPath: string = "";

      if (options) {
        defaultClientOptions = options.client;
        defaultPath = options.path;
      } else {
        defaultClientOptions = this.getters.clientOptions(site);
        defaultPath = this.getters.siteDefaultPath(site);
      }

      let savePath = this.pathHandler.getSavePath(defaultPath, site);
      // 取消
      if (savePath === false) {
        this.errorMsg = "用户已取消";
        return;
      }

      this.haveSuccess = true;
      this.successMsg = "正在发送种子到下载服务器……";

      let data: DownloadOptions = {
        url,
        title,
        savePath: savePath,
        autoStart: defaultClientOptions.autoStart,
        clientId: defaultClientOptions.id,
        link
      };
      this.writeLog({
        event: "SearchTorrent.sendTorrentClient",
        msg: "发送种子到下载服务器",
        data
      });
      extension
        .sendRequest(EAction.sendTorrentToClient, null, data)
        .then((result: any) => {
          console.log("命令执行完成", result);

          if (result.type == "success") {
            this.successMsg = result.msg;
            this.writeLog({
              event: "SearchTorrent.sendTorrentToClient.Success",
              msg: "发送种子到下载服务器成功",
              data: result
            });
          } else {
            this.errorMsg = result.msg;
            this.writeLog({
              event: "SearchTorrent.sendTorrentToClient.Error",
              msg: "发送种子到下载服务器失败",
              data: result
            });
          }
          callback && callback();
        })
        .catch((result: any) => {
          this.writeLog({
            event: "SearchTorrent.sendTorrentToClient.Error",
            msg: "发送种子到下载服务器失败",
            data: result
          });
          this.errorMsg = result.msg;
          callback && callback();
        });
    },
    /**
     * 更新分页信息
     * @param value
     */
    updatePagination(value: any) {
      console.log(value);
      this.$store.dispatch("updatePagination", {
        key: EPaginationKey.searchTorrent,
        options: value
      });
    },
    /**
     * 获取随机字符串
     * @param  {number} length    [长度，默认为16]
     * @param  {boolean} noSimilar [是否包含容易混淆的字符，默认为包含]
     * @return {string}           [返回的内容]
     */
    getRandomString(length: number = 16, noSimilar: boolean = true): string {
      // 是否包含容易混淆的字符[oO,Ll,9gq,Vv,Uu,I1]，默认为包含
      let chars = noSimilar
        ? "abcdefhijkmnprstwxyz2345678ABCDEFGHJKMNPQRSTWXYZ"
        : "abcdefghijkmnopqrstuvwxyz0123456789ABCDEFGHIJKMNOPQRSTUVWXYZ";
      let maxLength = chars.length;
      let result = [];
      for (let i = 0; i < length; i++) {
        result.push(chars.charAt(Math.floor(Math.random() * maxLength)));
      }

      return result.join("");
    },
    /**
     * 重设当前列表数据
     * @param datas
     */
    resetDatas(datas: any) {
      if (this.loading) return;
      if (datas.length) {
        this.pagination.page = 1;
        this.datas = datas;
        this.selected = [];
      }
    },
    /**
     * 下载已选中的种子文件
     */
    downloadSelected() {
      let files: downloadFile[] = [];
      this.selected.forEach((item: SearchResultItem) => {
        item.url &&
          files.push({
            url: item.url,
            fileName: `[${item.site.name}][${item.title}].torrent`,
            method: item.site.downloadMethod,
            timeout: this.options.connectClientTimeout
          });
      });
      console.log(files);
      if (files.length) {
        if (files.length > 1) {
          if (!confirm(this.words.multiDownloadConfirm)) {
            return;
          }
        }

        this.downloadTorrentFiles(files);
      }
    },
    /**
     * 批量下载指定的种子文件
     * @param files 需要下载的文件列表
     */
    downloadTorrentFiles(files: downloadFile[]) {
      this.downloading.count = files.length;
      this.downloading.completed = 0;
      this.downloading.speed = 0;
      this.downloading.progress = 0;
      new Downloader({
        files: files,
        autoStart: true,
        onCompleted: (file: FileDownloader) => {
          this.downloadTorrentFilesCompleted(file);
        },
        onError: (file: FileDownloader, e: any) => {
          this.downloadTorrentFilesCompleted();
          this.writeLog({
            event: "SearchTorrent.downloadSelected.Error",
            msg: "下载种子文件失败: " + file.fileName,
            data: e
          });
          let index = this.downloadFailedTorrents.findIndex(
            (item: FileDownloader) => {
              return item.url == file.url;
            }
          );
          if (index == -1) {
            this.downloadFailedTorrents.push(file);
          }
        }
      });
    },

    /**
     * 批量下载指定的种子文件完成
     * @param file
     */
    downloadTorrentFilesCompleted(file?: FileDownloader) {
      this.downloading.completed++;
      this.downloading.progress =
        (this.downloading.completed / this.downloading.count) * 100;

      // 是否已完成
      if (this.downloading.completed >= this.downloading.count) {
        this.downloading.count = 0;
        this.selected = [];
      }

      if (file) {
        // 从失败列表中删除已完成的种子
        for (
          let index = 0;
          index < this.downloadFailedTorrents.length;
          index++
        ) {
          const element = this.downloadFailedTorrents[index];
          if (element.url == file.url) {
            this.downloadFailedTorrents.splice(index, 1);
            break;
          }
        }
      }
    },

    /**
     * 保存当前行的种子文件
     * @param item
     */
    saveTorrentFile(item: SearchResultItem) {
      let requestMethod = ERequestMethod.GET;
      if (item.site) {
        requestMethod = item.site.downloadMethod || ERequestMethod.GET;
      }
      let url = item.url + "";
      let file = new FileDownloader({
        url,
        timeout: this.options.connectClientTimeout,
        fileName: `[${item.site.name}][${item.title}].torrent`
      });

      file.requestMethod = requestMethod;
      file.onError = (error: any) => {};
      file.start();
    },
    /**
     * 发送已选择的种子到下载服务器
     * @param datas
     * @param count
     */
    sendSelectedToClient(
      datas?: SearchResultItem[],
      count: number = 0,
      downloadOptions?: any
    ) {
      if (datas === undefined) {
        datas = [...this.selected];
        count = datas.length;
        this.sending.count = count;
        this.sending.completed = 0;
        this.sending.speed = 0;
        this.sending.progress = 0;
      }
      if (datas.length === 0) {
        this.sending.count = 0;
        return;
      }
      let data: SearchResultItem = datas.shift() as SearchResultItem;
      this.sendToClient(
        data.url as string,
        data.title,
        downloadOptions,
        () => {
          this.sending.completed++;
          this.sending.progress =
            (this.sending.completed / this.sending.count) * 100;

          // 是否已完成
          if (this.sending.completed >= this.sending.count) {
            this.sending.count = 0;
            this.selected = [];
            return;
          }
          this.sendSelectedToClient(datas, count, downloadOptions);
        },
        data.link
      );
    },
    /**
     * 复制当前链接到剪切板
     * @param url
     */
    copyLinkToClipboard(url: string) {
      this.successMsg = "";
      this.errorMsg = "";
      extension
        .sendRequest(EAction.copyTextToClipboard, null, url)
        .then(result => {
          this.successMsg = `下载链接已复制到剪切板`;
        })
        .catch(() => {
          this.errorMsg = "复制下载链接失败！";
        });
    },
    /**
     * 复制下载链接到剪切板
     */
    copySelectedToClipboard() {
      let urls: string[] = [];
      this.selected.forEach((item: SearchResultItem) => {
        item.url && urls.push(item.url);
      });
      this.clearMessage();
      extension
        .sendRequest(EAction.copyTextToClipboard, null, urls.join("\n"))
        .then(result => {
          this.successMsg = `${urls.length} 条下载链接已复制到剪切板`;
          this.selected = [];
        })
        .catch(() => {
          this.errorMsg = "复制下载链接失败！";
        });
    },
    clearMessage() {
      this.successMsg = "";
      this.errorMsg = "";
      this.haveSuccess = false;
      this.haveError = false;
    },

    /**
     * 根据指定的站点获取可用的下载目录及客户端信息
     * @param site
     */
    getSiteContentMenus(site: Site): any[] {
      let results: any[] = [];
      let clients: any[] = [];
      let host = site.host;
      if (!host) {
        return [];
      }

      if (this.siteContentMenus[host]) {
        return this.siteContentMenus[host];
      }

      /**
       * 增加下载目录
       * @param paths
       * @param client
       */
      function pushPath(paths: string[], client: any) {
        paths.forEach((path: string) => {
          results.push({
            client: client,
            path: path,
            host: site.host
          });
        });
      }

      this.options.clients.forEach((client: DownloadClient) => {
        clients.push({
          client: client,
          path: "",
          host: site.host
        });

        if (client.paths) {
          // 根据已定义的路径创建菜单
          for (const host in client.paths) {
            let paths = client.paths[host];

            if (host !== site.host) {
              continue;
            }

            pushPath(paths, client);
          }

          // 最后添加当前客户端适用于所有站点的目录
          let publicPaths = client.paths[ECommonKey.allSite];
          if (publicPaths) {
            if (results.length > 0) {
              results.push({});
            }

            pushPath(publicPaths, client);
          }
        }
      });

      if (results.length > 0) {
        clients.splice(0, 0, {});
      }

      results = results.concat(clients);

      this.siteContentMenus[host] = results;

      return results;
    },

    /**
     * 显示指定链接的下载服务器及目录菜单
     * @param options
     * @param event
     */
    showSiteContentMenus(options: SearchResultItem, event?: any) {
      let items = this.getSiteContentMenus(options.site);
      let menus: any[] = [];

      items.forEach((item: any) => {
        if (item.client && item.client.name) {
          menus.push({
            title:
              `下载到：${item.client.name} -> ${item.client.address}` +
              (item.path
                ? ` -> ${this.pathHandler.replacePathKey(
                    item.path,
                    options.site
                  )}`
                : ""),
            fn: () => {
              if (options.url) {
                // console.log(options, item);
                this.sendToClient(
                  options.url,
                  options.title,
                  item,
                  null,
                  options.link
                );
              }
            }
          });
        } else {
          menus.push({});
        }
      });

      console.log(items, menus);

      basicContext.show(menus, event);
      $(".basicContext").css({
        left: "-=20px",
        top: "+=10px"
      });
    },

    /**
     * 显示批量下载时可用下载服务器菜单
     * @param event
     */
    showAllContentMenus(event: any) {
      let clients: any[] = [];
      let menus: any[] = [];
      let _this = this;

      function addMenu(item: any) {
        let title = `下载到：${item.client.name} -> ${item.client.address}`;
        if (item.path) {
          title += ` -> ${item.path}`;
        }
        menus.push({
          title: title,
          fn: () => {
            _this.sendSelectedToClient(undefined, 0, item);
          }
        });
      }

      if (this.clientContentMenus.length == 0) {
        this.options.clients.forEach((client: DownloadClient) => {
          clients.push({
            client: client,
            path: ""
          });
        });
        clients.forEach((item: any) => {
          if (item.client && item.client.name) {
            addMenu(item);

            if (item.client.paths) {
              // 添加适用于所有站点的目录
              let publicPaths = item.client.paths[ECommonKey.allSite];
              if (publicPaths) {
                publicPaths.forEach((path: string) => {
                  // 去除带关键字的目录
                  if (
                    path.indexOf("$site.name$") == -1 &&
                    path.indexOf("$site.host$") == -1 &&
                    path.indexOf("<...>") == -1
                  ) {
                    let _item = this.clone(item);
                    _item.path = path;
                    addMenu(_item);
                  }
                });
              }
            }
          } else {
            menus.push({});
          }
        });
        this.clientContentMenus = menus;
      } else {
        menus = this.clientContentMenus;
      }

      basicContext.show(menus, event);
      $(".basicContext").css({
        left: "-=20px",
        top: "+=10px"
      });
    },

    /**
     * 重新搜索失败的站点
     */
    reSearchFailedSites() {
      if (this.searchResult.failedSites.length == 0) {
        return false;
      }

      let sites: Site[] = [];
      this.searchResult.failedSites.forEach((item: any) => {
        sites.push(item.site);
      });

      if (sites.length === 0) {
        this.errorMsg = "没有需要重新搜索的站点";
        return;
      }

      this.searchResult.failedSites = [];

      this.beginTime = dayjs();
      this.writeLog({
        event: `SearchTorrent.Search.Start`,
        msg: `准备开始搜索，共需搜索 ${sites.length} 个站点`,
        data: {
          key: this.key
        }
      });

      this.doSearchTorrentWithQueue(sites);
    },

    /**
     * 用JSON对象模拟对象克隆
     * @param source
     */
    clone(source: any) {
      return JSON.parse(JSON.stringify(source));
    },

    /**
     * 搜索结果过滤器，用于用户二次过滤
     * @param items
     * @param search
     */
    searchResultFilter(items: any[], search: string) {
      search = search.toString().toLowerCase();
      if (search.trim() === "") return items;

      // 以空格分隔要过滤的关键字
      let searchs = search.split(" ");

      return items.filter((item: SearchResultItem) => {
        // 过滤标题和副标题
        let source = (item.title + (item.subTitle || "")).toLowerCase();
        let result = true;
        searchs.forEach(key => {
          if (key.trim() != "") {
            result = result && source.indexOf(key) > -1;
          }
        });
        return result;
      });
    },

    getIMDbIdFromDouban(doubanId: string) {
      let match = doubanId.match(/douban(\d+)/);
      if (match && match.length >= 2) {
        this.searchMsg = "正在尝试转换豆瓣编号，请稍候……";
        return extension.sendRequest(
          EAction.getIMDbIdFromDouban,
          null,
          match[1]
        );
      } else {
        return new Promise<any>((resolve?: any, reject?: any) => {
          reject("无效的豆瓣ID");
        });
      }
    },

    /**
     * 重新下载失败的种子文件
     */
    reDownloadFailedTorrents() {
      this.downloadTorrentFiles(this.downloadFailedTorrents);
    }
  }
});
